import "server-only";
import { getCachedMyActiveRooms, getCachedOwnProfile } from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import { getCourse, listDepartments } from "@/lib/repositories/catalog";
import { countActiveStudentsByCourseIds, listMyEnrollments } from "@/lib/repositories/enrollments";
import { listEnrolledCourseStudents } from "@/lib/repositories/invitations";
import { countActiveRoomsByCourseIds, listOpenRooms } from "@/lib/repositories/rooms";
import { listEventRegistrations, listTestsForCourse } from "@/lib/repositories/tests";
import { listCourseTopics, listMyTopicProgress } from "@/lib/repositories/topics";
import { listAvailability } from "@/lib/repositories/availability";
import { listFavoriteCourseIds } from "@/lib/repositories/favorites";
import { computeMatchPercent } from "@/lib/matching/score";
import { summarizeTopics } from "@/lib/courses/topic-state";
import { timed } from "@/lib/perf/timing";
import { isOnline } from "@/lib/ui/people";
import { getDemoScenario } from "@/lib/demo/state";
import { demoCourseDetail } from "@/lib/demo/fixtures";

export type MemberStatus = "available" | "online" | "offline";

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
    availabilityRows,
    openRoomRows,
    registrationRows,
  ] = await Promise.all([
    pCourse,
    getCachedOwnProfile(userId),
    listMyEnrollments(supabase, userId),
    listEnrolledCourseStudents(supabase, courseId),
    getCachedMyActiveRooms(userId),
    pEvents,
    countActiveRoomsByCourseIds(supabase, [courseId]),
    countActiveStudentsByCourseIds(supabase, [courseId]),
    listCourseTopics(supabase, [courseId]),
    listMyTopicProgress(supabase, userId),
    listFavoriteCourseIds(supabase, userId),
    pCourse.then((c) => (c ? listDepartments(supabase, c.institution_id) : [])),
    listAvailability(supabase, [courseId]),
    listOpenRooms(supabase, [courseId]),
    pNextEvent.then((e) => (e ? listEventRegistrations(supabase, [e.id]) : [])),
  ]);

  const myEnrollment = myEnrollments.find((e) => e.course_id === courseId) ?? null;
  const isEnrolled = myEnrollment?.status === "active";

  const upcomingEvents = events.filter((e) => e.due_at && new Date(e.due_at).getTime() > now);
  const nextEvent = upcomingEvents[0] ?? null;

  // Rosters, availability, open rooms and registrations are for enrolled
  // students only.
  const availability = isEnrolled ? availabilityRows : [];
  const openRooms = isEnrolled ? openRoomRows : [];
  const registrations = isEnrolled ? registrationRows : [];
  const departmentsById = new Map(departments.map((d) => [d.id, d]));

  const topicSummary = summarizeTopics(topics, progress);
  const topicTitleById = new Map(topics.map((t) => [t.id, t.title]));
  const availabilityByUser = new Map(availability.map((a) => [a.user_id, a]));
  const myAvailability = availabilityByUser.get(userId) ?? null;

  const others = roster.filter((p) => p.id !== userId);
  const members = others
    .map((p) => {
      const status: MemberStatus = availabilityByUser.has(p.id)
        ? "available"
        : isOnline(p.last_seen_at, now)
          ? "online"
          : "offline";
      return { profile: p, status };
    })
    .sort((a, b) => {
      const rank = { available: 0, online: 1, offline: 2 } as const;
      return (
        rank[a.status] - rank[b.status] ||
        a.profile.full_name.localeCompare(b.profile.full_name, "he")
      );
    });

  const availableNow = others
    .filter((p) => availabilityByUser.has(p.id))
    .map((p) => {
      const a = availabilityByUser.get(p.id)!;
      return {
        profile: p,
        mode: a.mode,
        durationMinutes: a.duration_minutes,
        activity: a.activity,
        topicTitle: a.topic_id ? (topicTitleById.get(a.topic_id) ?? null) : null,
      };
    });

  const classmates = myProfile
    ? others
        .map((p) => ({ profile: p, match: computeMatchPercent(myProfile, p, departmentsById) }))
        .sort((a, b) => b.match.percent - a.match.percent)
    : [];

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
    myAvailability,
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
