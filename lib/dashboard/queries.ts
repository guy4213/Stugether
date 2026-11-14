import "server-only";
import { getCachedMyActiveRooms, getCachedOwnProfile } from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import { listPublicProfiles } from "@/lib/repositories/profiles";
import { listCourseRosters, listMyEnrollments } from "@/lib/repositories/enrollments";
import { listActiveMembersOfRooms, listOpenRooms } from "@/lib/repositories/rooms";
import { listDepartments } from "@/lib/repositories/catalog";
import { listCourseTopics, listMyTopicProgress } from "@/lib/repositories/topics";
import { listUpcomingTestsForCourses } from "@/lib/repositories/tests";
import { listNotifications, type NotificationType } from "@/lib/repositories/notifications";
import { getUnreadSummary } from "@/lib/repositories/messages";
import { listPendingInvitations } from "@/lib/repositories/invitations";
import { listUpcomingSessions } from "@/lib/repositories/sessions";
import { summarizeTopics, type TopicWithState } from "@/lib/courses/topic-state";
import { dashboardRoom, type RoomPerson } from "@/lib/dashboard/room-row";
import { computeMatchPercent } from "@/lib/matching/score";
import { isOnline } from "@/lib/ui/people";
import { yearLabel } from "@/lib/ui/labels";
import { isRoomLive } from "@/lib/stats/live";
import { timed } from "@/lib/perf/timing";
import { getDemoScenario } from "@/lib/demo/state";
import { demoDashboard } from "@/lib/demo/fixtures";
import type { StackPerson } from "@/components/ui/avatar-stack";

const DAY_MS = 86_400_000;

export type CourseBadge =
  { kind: "live" } | { kind: "test" } | { kind: "learners"; count: number } | null;

export interface DashboardCourse {
  id: string;
  name: string;
  code: string | null;
  /** "שנה א׳" */
  yearLabel: string | null;
  progress: number;
  completed: boolean;
  badge: CourseBadge;
  people: StackPerson[];
  /** Everyone enrolled, me included. */
  studentCount: number;
  topicsTotal: number;
  topicsMastered: number;
  /** The topic in progress (or the first not yet mastered). */
  currentTopic: string | null;
  continueHref: string;
}

// "שותפים ללמידה": classmates with the best match.
export interface DashboardPartner {
  id: string;
  name: string;
  avatarPath: string | null;
  departmentName: string | null;
  year: string | null;
  online: boolean;
  lastSeenAt: string | null;
  percent: number;
  reasons: string[];
  sharedCourses: { id: string; name: string }[];
}

const PARTNERS_SHOWN = 12;

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

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const demo = await getDemoScenario();
  if (demo) return demoDashboard(demo);
  return timed("page.dashboard", loadDashboardData(userId));
}

async function loadDashboardData(userId: string) {
  const supabase = await createClient();

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
  const pRosters = pCourseIds.then((ids) => listCourseRosters(supabase, ids));
  const now = Date.now();
  // One batched lookup for every person shown on the page.
  const pPeople = Promise.all([pRosters, pNotifications]).then(([rosterRows, notificationRows]) => {
    const personIds = new Set<string>();
    rosterRows.forEach((r) => personIds.add(r.user_id));
    notificationRows.forEach((n) => n.actor_id && personIds.add(n.actor_id));
    personIds.delete(userId);
    return listPublicProfiles(supabase, [...personIds]);
  });
  const pMyRooms = getCachedMyActiveRooms(userId);
  const pMyRoomIds = pMyRooms.then((rooms) => rooms.map((r) => r.id));

  const [
    profile,
    enrollments,
    myRooms,
    progress,
    events,
    notifications,
    invitations,
    unreadSummary,
    topics,
    rosters,
    openRooms,
    departments,
    people,
    upcomingSessions,
    roomMembers,
  ] = await Promise.all([
    pProfile,
    pEnrollments,
    pMyRooms,
    listMyTopicProgress(supabase, userId),
    pEvents,
    pNotifications,
    listPendingInvitations(supabase),
    getUnreadSummary(supabase),
    pCourseIds.then((ids) => listCourseTopics(supabase, ids)),
    pRosters,
    pCourseIds.then((ids) => listOpenRooms(supabase, ids)),
    pInstitutionId.then((id) => (id ? listDepartments(supabase, id) : [])),
    pPeople,
    pMyRoomIds.then((ids) => listUpcomingSessions(supabase, ids)),
    pMyRoomIds.then((ids) => listActiveMembersOfRooms(supabase, ids)),
  ]);

  const active = enrollments.filter((e) => e.status === "active");
  const upcomingEvents = events.filter((e) => e.due_at && new Date(e.due_at).getTime() > now);
  const profileById = new Map(people.map((p) => [p.id, p]));
  const personById = new Map(
    people.map((p) => [p.id, { id: p.id, name: p.full_name, avatarPath: p.avatar_url }]),
  );
  const person = (id: string): StackPerson | null => personById.get(id) ?? null;
  const toPeople = (ids: string[]) => ids.map(person).filter((p): p is StackPerson => p !== null);

  // --- per-course derived state ----------------------------------------------
  const topicsByCourse = new Map<string, typeof topics>();
  for (const t of topics) {
    topicsByCourse.set(t.course_id, [...(topicsByCourse.get(t.course_id) ?? []), t]);
  }
  const classmatesByCourse = new Map<string, string[]>();
  const rosterCountByCourse = new Map<string, number>();
  for (const r of rosters) {
    rosterCountByCourse.set(r.course_id, (rosterCountByCourse.get(r.course_id) ?? 0) + 1);
    if (r.user_id === userId) continue;
    classmatesByCourse.set(r.course_id, [
      ...(classmatesByCourse.get(r.course_id) ?? []),
      r.user_id,
    ]);
  }
  // "Available now" = classmates connected to the platform right now.
  const availableByCourse = new Map<string, string[]>();
  for (const [courseId, ids] of classmatesByCourse) {
    availableByCourse.set(
      courseId,
      ids.filter((id) => isOnline(profileById.get(id)?.last_seen_at, now)),
    );
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
    const topicSummary = summarizeTopics(topicsByCourse.get(e.course_id) ?? [], progress);
    return {
      id: e.course_id,
      name: e.course.name,
      code: e.course.code,
      yearLabel: yearLabel(e.course.year_level),
      progress: e.progress_percent,
      completed: e.progress_percent >= 100,
      badge,
      people: toPeople(classmatesByCourse.get(e.course_id) ?? []),
      // Rosters include me; at least 1 even if RLS returned nothing.
      studentCount: Math.max(1, rosterCountByCourse.get(e.course_id) ?? 0),
      topicsTotal: topicSummary.total,
      topicsMastered: topicSummary.mastered,
      currentTopic: topicSummary.current?.title ?? null,
      continueHref: continueHref(e.course_id),
    };
  });

  // --- heroes: "ההתקדמות שלי", one slide per unfinished course ----------------------
  type Hero = {
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
  };
  const heroes: Hero[] = orderedCourses
    .filter((e) => e.progress_percent < 100)
    .map((heroEnrollment) => {
      const summary = summarizeTopics(topicsByCourse.get(heroEnrollment.course_id) ?? [], progress);
      return {
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
    });
  const hero: Hero | null = heroes[0] ?? null;

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

  // --- study partners: classmates, best match first ---------------------------------
  const departmentsById = new Map(departments.map((d) => [d.id, d]));
  const courseNames = new Map(active.map((e) => [e.course_id, e.course.name]));
  const sharedByUser = new Map<string, string[]>();
  for (const [courseId, ids] of classmatesByCourse) {
    for (const id of ids) sharedByUser.set(id, [...(sharedByUser.get(id) ?? []), courseId]);
  }
  const partners: DashboardPartner[] = profile
    ? [...sharedByUser]
        .map(([id, courseIdsShared]) => {
          const p = profileById.get(id);
          if (!p) return null;
          const match = computeMatchPercent(profile, p, departmentsById, courseIdsShared.length);
          return {
            id,
            name: p.full_name,
            avatarPath: p.avatar_url,
            departmentName: p.department_id
              ? (departmentsById.get(p.department_id)?.name ?? null)
              : null,
            year: yearLabel(p.study_year),
            online: isOnline(p.last_seen_at, now),
            lastSeenAt: p.last_seen_at,
            percent: match.percent,
            reasons: match.breakdown
              .filter((b) => b.matched)
              .slice(0, 3)
              .map((b) => b.label),
            sharedCourses: courseIdsShared.map((c) => ({ id: c, name: courseNames.get(c) ?? "" })),
          };
        })
        .filter((p): p is DashboardPartner => p !== null)
        .sort(
          (a, b) =>
            b.percent - a.percent ||
            Number(b.online) - Number(a.online) ||
            a.name.localeCompare(b.name, "he"),
        )
        .slice(0, PARTNERS_SHOWN)
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

  // --- next event (shown at the end of "פעילות אחרונה") ------------------------------------
  const nextEventRaw = upcomingEvents[0] ?? null;
  const nextEvent = nextEventRaw
    ? {
        id: nextEventRaw.id,
        courseId: nextEventRaw.course_id,
        courseName: courseNames.get(nextEventRaw.course_id) ?? null,
        title: nextEventRaw.title,
        kind: nextEventRaw.kind,
        dueAt: nextEventRaw.due_at!,
      }
    : null;

  // --- my rooms (SPEC §4.2: by last message, with unread) + pending invitations ---
  const unreadByRoom = new Map(unreadSummary.map((u) => [u.room_id, u]));
  // Ordered by start time: the first row per room is its next session.
  const nextSessionByRoom = new Map<string, string>();
  for (const s of upcomingSessions)
    if (!nextSessionByRoom.has(s.room_id)) nextSessionByRoom.set(s.room_id, s.starts_at);
  const membersByRoom = new Map<string, RoomPerson[]>();
  const onlineOthersByRoom = new Map<string, number>();
  for (const m of roomMembers) {
    membersByRoom.set(m.room_id, [
      ...(membersByRoom.get(m.room_id) ?? []),
      { id: m.user_id, name: m.full_name, avatarPath: m.avatar_url },
    ]);
    if (m.user_id !== userId && isOnline(m.last_seen_at, now)) {
      onlineOthersByRoom.set(m.room_id, (onlineOthersByRoom.get(m.room_id) ?? 0) + 1);
    }
  }
  const courseNameById = new Map(enrollments.map((e) => [e.course_id, e.course.name]));
  const rooms = myRooms
    .map((r) =>
      dashboardRoom({
        room: r,
        courseName: courseNameById.get(r.course_id) ?? null,
        unread: Number(unreadByRoom.get(r.id)?.unread_count ?? 0),
        lastMessageAt: unreadByRoom.get(r.id)?.last_message_at ?? r.last_message_at,
        nextSessionAt: nextSessionByRoom.get(r.id) ?? null,
        people: membersByRoom.get(r.id) ?? [],
        now,
        onlineOthers: onlineOthersByRoom.get(r.id) ?? 0,
      }),
    )
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

  return {
    firstName: profile?.full_name.split(/\s+/)[0] ?? "",
    hero,
    heroes,
    stats,
    myCourses,
    partners,
    activity,
    pendingInvitationCount: pendingInvitations.length,
    nextEvent,
    rooms,
    pendingInvitations,
    roomCourses: active.map((e) => ({ id: e.course_id, name: e.course.name })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;
