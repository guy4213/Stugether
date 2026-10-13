import "server-only";
import { getCachedMyActiveRooms, getCachedOwnProfile } from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import { getCourse, listDepartments } from "@/lib/repositories/catalog";
import { countActiveStudentsByCourseIds, listMyEnrollments } from "@/lib/repositories/enrollments";
import { listEnrolledCourseStudents } from "@/lib/repositories/invitations";
import { countActiveRoomsByCourseIds, listOpenRooms } from "@/lib/repositories/rooms";
import { listEventRegistrations, listTestsForCourse } from "@/lib/repositories/tests";
import { listCourseTopics, listMyTopicProgress } from "@/lib/repositories/topics";
import { listFavoriteCourseIds } from "@/lib/repositories/favorites";
import { computeMatchPercent } from "@/lib/matching/score";
import { sharedCoursesByUser } from "@/lib/matching/shared-courses";
import { summarizeTopics } from "@/lib/courses/topic-state";
import { timed } from "@/lib/perf/timing";
import { isOnline } from "@/lib/ui/people";
import { getDemoScenario } from "@/lib/demo/state";
import { demoCourseDetail } from "@/lib/demo/fixtures";

// "Available" = connected to the platform right now (no manual toggle).
export type MemberStatus = "available" | "offline";

export async function getCourseDetailData(
  userId: string,
  courseId: string,
): Promise<CourseDetailData> {
  const demo = await getDemoScenario();
  if (demo) return demoCourseDetail(demo, courseId);
  return timed("page.courseDetail", loadCourseDetailData(userId, courseId));
}

async function loadCourseDetailData(userId: string, courseId: string) {
  const supabase = await createClient();
  const now = Date.now();

  // A dependency graph, not two rounds: departments wait only for the course,
  // registrations only for the events. Availability and open rooms start right
  // away; RLS shows them only to enrolled students, and they're dropped below
  // for anyone who isn't.
  const pCourse = getCourse(supabase, courseId);
  const pEvents = listTestsForCourse(supabase, courseId);
  const pMyEnrollments = listMyEnrollments(supabase, userId);
  const pShared = pMyEnrollments.then((rows) =>
    sharedCoursesByUser(
      supabase,
      rows.filter((e) => e.status === "active").map((e) => e.course_id),
      userId,
    ),
  );
  const pNextEvent = pEvents.then(
    (rows) => rows.find((e) => e.due_at && new Date(e.due_at).getTime() > now) ?? null,
  );

  const [
    course,
    myProfile,
    myEnrollments,
    roster,
    myActiveRooms,
    events,
    roomCounts,
    studentCounts,
    topics,
    progress,
    favoriteIds,
    departments,
    openRoomRows,
    registrationRows,
    sharedCourses,
  ] = await Promise.all([
    pCourse,
    getCachedOwnProfile(userId),
    pMyEnrollments,
    listEnrolledCourseStudents(supabase, courseId),
    getCachedMyActiveRooms(userId),
    pEvents,
    countActiveRoomsByCourseIds(supabase, [courseId]),
    countActiveStudentsByCourseIds(supabase, [courseId]),
    listCourseTopics(supabase, [courseId]),
    listMyTopicProgress(supabase, userId),
    listFavoriteCourseIds(supabase, userId),
    pCourse.then((c) => (c ? listDepartments(supabase, c.institution_id) : [])),
    listOpenRooms(supabase, [courseId]),
    pNextEvent.then((e) => (e ? listEventRegistrations(supabase, [e.id]) : [])),
    pShared,
  ]);

  const myEnrollment = myEnrollments.find((e) => e.course_id === courseId) ?? null;
  const isEnrolled = myEnrollment?.status === "active";

  const upcomingEvents = events.filter((e) => e.due_at && new Date(e.due_at).getTime() > now);
  const nextEvent = upcomingEvents[0] ?? null;

  // Rosters, open rooms and registrations are for enrolled students only.
  const openRooms = isEnrolled ? openRoomRows : [];
  const registrations = isEnrolled ? registrationRows : [];
  const departmentsById = new Map(departments.map((d) => [d.id, d]));

  const topicSummary = summarizeTopics(topics, progress);

  const others = roster.filter((p) => p.id !== userId);
  const members = others
    .map((p) => {
      const status: MemberStatus = isOnline(p.last_seen_at, now) ? "available" : "offline";
      return { profile: p, status };
    })
    .sort((a, b) => {
      const rank = { available: 0, offline: 1 } as const;
      return (
        rank[a.status] - rank[b.status] ||
        a.profile.full_name.localeCompare(b.profile.full_name, "he")
      );
    });

  const classmates = myProfile
    ? others
        .map((p) => ({
          profile: p,
          match: computeMatchPercent(
            myProfile,
            p,
            departmentsById,
            sharedCourses.get(p.id)?.length ?? 0,
          ),
        }))
        .sort((a, b) => b.match.percent - a.match.percent)
    : [];
  const matchById = new Map(classmates.map((c) => [c.profile.id, c.match.percent]));

  // Classmates connected right now, best match first.
  const availableNow = others
    .filter((p) => isOnline(p.last_seen_at, now))
    .map((p) => ({ profile: p, matchPercent: matchById.get(p.id) ?? null }))
    .sort((a, b) => (b.matchPercent ?? 0) - (a.matchPercent ?? 0));

  const myRoomsForCourse = myActiveRooms.filter(
    (r) => r.course_id === courseId && r.status === "active",
  );
  const joinableOpenRooms = openRooms.filter((r) => !r.is_member && r.member_count < 4);
  const registeredIds = registrations.map((r) => r.user_id);

  return {
    course,
    departmentName: course?.department_id
      ? (departmentsById.get(course.department_id)?.name ?? null)
      : null,
    isEnrolled,
    isFavorite: favoriteIds.includes(courseId),
    progressPercent: myEnrollment?.progress_percent ?? 0,
    studentCount: studentCounts[courseId] ?? 0,
    activeRoomCount: roomCounts[courseId] ?? 0,
    myRoomsForCourse,
    joinableOpenRooms,
    topics: topicSummary,
    availableNow,
    members,
    classmates,
    upcomingEvents,
    nextEvent: nextEvent
      ? {
          ...nextEvent,
          registeredCount: registeredIds.length,
          isRegistered: registeredIds.includes(userId),
        }
      : null,
  };
}

export type CourseDetailData = Awaited<ReturnType<typeof loadCourseDetailData>>;
