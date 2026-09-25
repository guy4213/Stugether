import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCourse, listDepartments } from "@/lib/repositories/catalog";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { countActiveStudentsByCourseIds, listMyEnrollments } from "@/lib/repositories/enrollments";
import { listEnrolledCourseStudents } from "@/lib/repositories/invitations";
import {
  listMyActiveRooms,
  countActiveRoomsByCourseIds,
  listOpenRooms,
} from "@/lib/repositories/rooms";
import { listEventRegistrations, listTestsForCourse } from "@/lib/repositories/tests";
import { listCourseTopics, listMyTopicProgress } from "@/lib/repositories/topics";
import { listAvailability } from "@/lib/repositories/availability";
import { listFavoriteCourseIds } from "@/lib/repositories/favorites";
import { computeMatchPercent } from "@/lib/matching/score";
import { summarizeTopics } from "@/lib/courses/topic-state";
import { isOnline } from "@/lib/ui/people";

export type MemberStatus = "available" | "online" | "offline";

export async function getCourseDetailData(userId: string, courseId: string) {
  const supabase = await createClient();
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
  ] = await Promise.all([
    getCourse(supabase, courseId),
    getOwnProfile(supabase, userId),
    listMyEnrollments(supabase, userId),
    listEnrolledCourseStudents(supabase, courseId),
    listMyActiveRooms(supabase, userId),
    listTestsForCourse(supabase, courseId),
    countActiveRoomsByCourseIds(supabase, [courseId]),
    countActiveStudentsByCourseIds(supabase, [courseId]),
    listCourseTopics(supabase, [courseId]),
    listMyTopicProgress(supabase, userId),
    listFavoriteCourseIds(supabase, userId),
  ]);

  const myEnrollment = myEnrollments.find((e) => e.course_id === courseId) ?? null;
  const isEnrolled = myEnrollment?.status === "active";

  const now = Date.now();
  const upcomingEvents = events.filter((e) => e.due_at && new Date(e.due_at).getTime() > now);
  const nextEvent = upcomingEvents[0] ?? null;

  // Rosters, availability, open rooms and registrations are only visible to
  // enrolled students (RLS); skip the round trips otherwise.
  const [departments, availability, openRooms, registrations] = await Promise.all([
    course ? listDepartments(supabase, course.institution_id) : Promise.resolve([]),
    isEnrolled ? listAvailability(supabase, [courseId]) : Promise.resolve([]),
    isEnrolled ? listOpenRooms(supabase, [courseId]) : Promise.resolve([]),
    isEnrolled && nextEvent
      ? listEventRegistrations(supabase, [nextEvent.id])
      : Promise.resolve([]),
  ]);
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
      return rank[a.status] - rank[b.status] || a.profile.full_name.localeCompare(b.profile.full_name, "he");
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

export type CourseDetailData = Awaited<ReturnType<typeof getCourseDetailData>>;
