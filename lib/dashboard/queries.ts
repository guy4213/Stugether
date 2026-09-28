import "server-only";
import {
  getCachedMyActiveRooms,
  getCachedOwnProfile,
  getCachedUnreadNotificationCount,
} from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import { listPublicProfiles } from "@/lib/repositories/profiles";
import {
  countActiveStudentsByCourseIds,
  listCourseRosters,
  listMyEnrollments,
} from "@/lib/repositories/enrollments";
import { countActiveRoomsByCourseIds, listOpenRooms } from "@/lib/repositories/rooms";
import { listActiveCourses, listDepartments } from "@/lib/repositories/catalog";
import { listCourseTopics, listMyTopicProgress } from "@/lib/repositories/topics";
import { listAvailability } from "@/lib/repositories/availability";
import { listEventRegistrations, listUpcomingTestsForCourses } from "@/lib/repositories/tests";
import { listNotifications, type NotificationType } from "@/lib/repositories/notifications";
import { getUnreadSummary, listMyMessageTimestamps } from "@/lib/repositories/messages";
import { listPendingInvitations } from "@/lib/repositories/invitations";
import { summarizeTopics, type TopicWithState } from "@/lib/courses/topic-state";
import { computeStreak } from "@/lib/stats/streak";
import { computeCourseMatch } from "@/lib/stats/course-match";
import { isRoomLive } from "@/lib/stats/live";
import type { StackPerson } from "@/components/ui/avatar-stack";

const DAY_MS = 86_400_000;

export type CourseBadge =
  { kind: "live" } | { kind: "test" } | { kind: "learners"; count: number } | null;

export interface DashboardCourse {
  id: string;
  name: string;
  code: string | null;
  progress: number;
  completed: boolean;
  badge: CourseBadge;
  people: StackPerson[];
  continueHref: string;
}

export interface ActivityItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  createdAt: string;
  unread: boolean;
  actor: StackPerson | null;
  joinRoomId: string | null;
}

export async function getDashboardData(userId: string) {
  const supabase = await createClient();
  const since60 = new Date(Date.now() - 60 * DAY_MS).toISOString();

  // A dependency graph, not rounds: every query starts as soon as what it
  // needs has arrived (e.g. rosters wait only for my enrollments, the catalog
  // only for my profile), so the slowest chain is enrollments → rosters →
  // profiles instead of four sequential Promise.all rounds.
  const pProfile = getCachedOwnProfile(userId);
  const pEnrollments = listMyEnrollments(supabase, userId);
  const pNotifications = listNotifications(supabase, userId, { limit: 4 });

  const pCourseIds = pEnrollments.then((rows) =>
    rows.filter((e) => e.status === "active").map((e) => e.course_id),
  );
  const pEvents = pCourseIds.then((ids) => listUpcomingTestsForCourses(supabase, ids));
  const pInstitutionId = pProfile.then((p) => p?.institution_id ?? null);
  const pInstitutionCourses = pInstitutionId.then((id) =>
    id ? listActiveCourses(supabase, { institutionId: id }) : [],
  );
  const pRosters = pCourseIds.then((ids) => listCourseRosters(supabase, ids));
  const pAvailability = pCourseIds.then((ids) => listAvailability(supabase, ids));
  const now = Date.now();
  const pNextEvent = pEvents.then(
    (events) => events.find((e) => e.due_at && new Date(e.due_at).getTime() > now) ?? null,
  );
  const pRegistrations = pNextEvent.then((e) => listEventRegistrations(supabase, e ? [e.id] : []));
  // Catalog recommendations: my institution's courses I'm not enrolled in.
  const pCandidateIds = Promise.all([pInstitutionCourses, pCourseIds]).then(([courses, ids]) =>
    courses.filter((c) => !ids.includes(c.id)).map((c) => c.id),
  );
  // One batched lookup for every person shown on the page.
  const pPeople = Promise.all([pRosters, pAvailability, pRegistrations, pNotifications]).then(
    ([rosterRows, availabilityRows, registrationRows, notificationRows]) => {
      const personIds = new Set<string>();
      rosterRows.forEach((r) => personIds.add(r.user_id));
      availabilityRows.forEach((a) => personIds.add(a.user_id));
      registrationRows.forEach((r) => personIds.add(r.user_id));
      notificationRows.forEach((n) => n.actor_id && personIds.add(n.actor_id));
      personIds.delete(userId);
      return listPublicProfiles(supabase, [...personIds]);
    },
  );

  const [
    profile,
    enrollments,
    myRooms,
    progress,
    messageTimes,
    events,
    notifications,
    unreadCount,
    invitations,
    unreadSummary,
    courseIds,
    topics,
    rosters,
    availability,
    openRooms,
    institutionCourses,
    departments,
    nextEventRaw,
    registrations,
    studentCounts,
    roomCounts,
    people,
  ] = await Promise.all([
    pProfile,
    pEnrollments,
    getCachedMyActiveRooms(userId),
    listMyTopicProgress(supabase, userId),
    listMyMessageTimestamps(supabase, userId, since60),
    pEvents,
    pNotifications,
    getCachedUnreadNotificationCount(userId),
    listPendingInvitations(supabase),
    getUnreadSummary(supabase),
    pCourseIds,
    pCourseIds.then((ids) => listCourseTopics(supabase, ids)),
    pRosters,
    pAvailability,
    pCourseIds.then((ids) => listOpenRooms(supabase, ids)),
    pInstitutionCourses,
    pInstitutionId.then((id) => (id ? listDepartments(supabase, id) : [])),
    pNextEvent,
    pRegistrations,
    pCandidateIds.then((ids) => countActiveStudentsByCourseIds(supabase, ids)),
    pCandidateIds.then((ids) => countActiveRoomsByCourseIds(supabase, ids)),
    pPeople,
  ]);

  const active = enrollments.filter((e) => e.status === "active");
  const upcomingEvents = events.filter((e) => e.due_at && new Date(e.due_at).getTime() > now);
  const candidateCourses = institutionCourses.filter((c) => !courseIds.includes(c.id));
  const personById = new Map(people.map((p) => [p.id, { id: p.id, name: p.full_name }]));
  const person = (id: string): StackPerson | null => personById.get(id) ?? null;
  const toPeople = (ids: string[]) => ids.map(person).filter((p): p is StackPerson => p !== null);

  // --- per-course derived state ----------------------------------------------
  const topicsByCourse = new Map<string, typeof topics>();
  for (const t of topics) {
    topicsByCourse.set(t.course_id, [...(topicsByCourse.get(t.course_id) ?? []), t]);
  }
  const classmatesByCourse = new Map<string, string[]>();
  for (const r of rosters) {
    if (r.user_id === userId) continue;
    classmatesByCourse.set(r.course_id, [
      ...(classmatesByCourse.get(r.course_id) ?? []),
      r.user_id,
    ]);
  }
  const availableByCourse = new Map<string, string[]>();
  for (const a of availability) {
    if (a.user_id === userId) continue;
    availableByCourse.set(a.course_id, [...(availableByCourse.get(a.course_id) ?? []), a.user_id]);
  }
  const myActiveRooms = myRooms.filter((r) => r.status === "active");
  const myRoomByCourse = new Map<string, (typeof myActiveRooms)[number]>();
  for (const r of myActiveRooms)
    if (!myRoomByCourse.has(r.course_id)) myRoomByCourse.set(r.course_id, r);
  const openRoomByCourse = new Map<string, (typeof openRooms)[number]>();
  for (const r of openRooms) {
    if (!r.is_member && r.member_count < 4 && !openRoomByCourse.has(r.course_id)) {
      openRoomByCourse.set(r.course_id, r);
    }
  }
  const testSoonByCourse = new Set(
    upcomingEvents
      .filter((e) => e.kind === "test" && new Date(e.due_at!).getTime() - now < 7 * DAY_MS)
      .map((e) => e.course_id),
  );

  const continueHref = (courseId: string) => {
    const room = myRoomByCourse.get(courseId);
    return room ? `/rooms/${room.id}` : `/courses/${courseId}`;
  };

  // In-progress courses first (highest progress first), completed ones last.
  const orderedCourses = [...active].sort((a, b) => {
    const aDone = a.progress_percent >= 100 ? 1 : 0;
    const bDone = b.progress_percent >= 100 ? 1 : 0;
    return aDone - bDone || b.progress_percent - a.progress_percent;
  });

  const myCourses: DashboardCourse[] = orderedCourses.map((e) => {
    const room = myRoomByCourse.get(e.course_id);
    const learners = availableByCourse.get(e.course_id)?.length ?? 0;
    let badge: CourseBadge = null;
    if ((room && isRoomLive(room)) || openRoomByCourse.has(e.course_id)) badge = { kind: "live" };
    else if (testSoonByCourse.has(e.course_id)) badge = { kind: "test" };
    else if (learners > 0) badge = { kind: "learners", count: learners };
    return {
      id: e.course_id,
      name: e.course.name,
      code: e.course.code,
      progress: e.progress_percent,
      completed: e.progress_percent >= 100,
      badge,
      people: toPeople(classmatesByCourse.get(e.course_id) ?? []),
      continueHref: continueHref(e.course_id),
    };
  });

  // --- hero: the course to continue ---------------------------------------------
  const heroEnrollment = orderedCourses.find((e) => e.progress_percent < 100) ?? null;
  let hero: {
    courseId: string;
    name: string;
    code: string | null;
    progress: number;
    topics: TopicWithState[];
    total: number;
    mastered: number;
    currentTopic: string | null;
    currentIndex: number;
    availableNow: StackPerson[];
    continueHref: string;
    myRoomId: string | null;
    openRoomId: string | null;
  } | null = null;
  if (heroEnrollment) {
    const summary = summarizeTopics(topicsByCourse.get(heroEnrollment.course_id) ?? [], progress);
    hero = {
      courseId: heroEnrollment.course_id,
      name: heroEnrollment.course.name,
      code: heroEnrollment.course.code,
      progress: heroEnrollment.progress_percent,
      topics: summary.topics,
      total: summary.total,
      mastered: summary.mastered,
      currentTopic: summary.current?.title ?? null,
      currentIndex: summary.currentIndex,
      availableNow: toPeople(availableByCourse.get(heroEnrollment.course_id) ?? []),
      continueHref: continueHref(heroEnrollment.course_id),
      myRoomId: myRoomByCourse.get(heroEnrollment.course_id)?.id ?? null,
      openRoomId: openRoomByCourse.get(heroEnrollment.course_id)?.room_id ?? null,
    };
  }

  // --- stats strip ----------------------------------------------------------------
  const partnerIds = [...new Set(rosters.map((r) => r.user_id).filter((id) => id !== userId))];
  const inProgress = active.filter((e) => e.progress_percent < 100);
  const avgProgress = inProgress.length
    ? Math.round(inProgress.reduce((s, e) => s + e.progress_percent, 0) / inProgress.length)
    : active.length
      ? 100
      : 0;
  const stats = {
    activeCourses: active.length,
    courseBars: orderedCourses.slice(0, 5).map((e) => e.progress_percent),
    activeRooms: myActiveRooms.length,
    liveRooms: myActiveRooms.filter((r) => isRoomLive(r)).length,
    partners: partnerIds.length,
    partnerPeople: toPeople(partnerIds),
    avgProgress,
  };

  // --- recommendations --------------------------------------------------------------
  const departmentsById = new Map(departments.map((d) => [d.id, d]));
  const recommendations = profile
    ? candidateCourses
        .map((c) => ({
          id: c.id,
          name: c.name,
          departmentId: c.department_id,
          students: studentCounts[c.id] ?? 0,
          match: computeCourseMatch(profile, c, departmentsById, roomCounts[c.id] ?? 0),
        }))
        .sort((a, b) => b.match - a.match || b.students - a.students)
    : [];

  // --- activity feed ------------------------------------------------------------------
  const joinableOpenRooms = new Set(
    openRooms.filter((r) => !r.is_member && r.member_count < 4).map((r) => r.room_id),
  );
  const activity: ActivityItem[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    unread: n.read_at === null,
    actor: n.actor_id ? person(n.actor_id) : null,
    joinRoomId:
      n.type === "room_opened" && n.room_id && joinableOpenRooms.has(n.room_id) ? n.room_id : null,
  }));

  // --- next event -------------------------------------------------------------------------
  const nextEvent = nextEventRaw
    ? {
        id: nextEventRaw.id,
        courseId: nextEventRaw.course_id,
        title: nextEventRaw.title,
        kind: nextEventRaw.kind,
        dueAt: nextEventRaw.due_at!,
        registered: toPeople(registrations.map((r) => r.user_id)),
        registeredCount: registrations.length,
      }
    : null;

  // --- my rooms (SPEC §4.2: by last message, with unread) + pending invitations ---
  const unreadByRoom = new Map(unreadSummary.map((u) => [u.room_id, u]));
  const courseNameById = new Map(enrollments.map((e) => [e.course_id, e.course.name]));
  const rooms = myRooms
    .map((r) => ({
      id: r.id,
      name: r.name,
      courseName: courseNameById.get(r.course_id) ?? null,
      status: r.status,
      unread: Number(unreadByRoom.get(r.id)?.unread_count ?? 0),
      lastMessageAt: unreadByRoom.get(r.id)?.last_message_at ?? r.last_message_at,
      live: r.status === "active" && isRoomLive(r),
    }))
    .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
  // get_pending_invitations already hides expired ones; re-check against the
  // clock in case the page is rendered right at the boundary.
  const pendingInvitations = invitations
    .filter((i) => new Date(i.expires_at).getTime() > now)
    .map((i) => ({
      id: i.id,
      roomName: i.room_name,
      courseName: i.course_name,
      inviter: { id: i.inviter_id, name: i.inviter_name },
      expiresAt: i.expires_at,
    }));

  // --- streak / weekly activity -----------------------------------------------------------
  const activityTimes = [...messageTimes, ...progress.map((p) => p.updated_at)];
  const weekAgo = now - 7 * DAY_MS;

  return {
    // SPEC §4.1: a student without an institution hasn't finished onboarding.
    needsOnboarding: !!profile && profile.role === "student" && !profile.institution_id,
    firstName: profile?.full_name.split(/\s+/)[0] ?? "",
    streak: computeStreak(activityTimes),
    messagesThisWeek: messageTimes.filter((t) => new Date(t).getTime() >= weekAgo).length,
    hero,
    stats,
    myCourses,
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    recommendations,
    activity,
    unreadCount,
    nextEvent,
    rooms,
    pendingInvitations,
    roomCourses: active.map((e) => ({ id: e.course_id, name: e.course.name })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
