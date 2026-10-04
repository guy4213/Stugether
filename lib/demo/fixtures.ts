import "server-only";
import {
  DEMO_AVATAR_PREFIX,
  DEMO_INFI_COURSE_ID,
  DEMO_LIVE_ROOM_ID,
  DEMO_USER_ID,
  demoId,
  type DemoScenario,
} from "@/lib/demo/constants";
import { computeMatchPercent } from "@/lib/matching/score";
import { computeCourseMatch } from "@/lib/stats/course-match";
import { isRoomLive } from "@/lib/stats/live";
import { israelDayKey } from "@/lib/stats/streak";
import { summarizeTopics } from "@/lib/courses/topic-state";
import { isOnline } from "@/lib/ui/people";
import type { Course, Department, Faculty, Institution } from "@/lib/repositories/catalog";
import type { Profile, PublicProfile } from "@/lib/repositories/profiles";
import type { OpenRoom, Room, RoomMember } from "@/lib/repositories/rooms";
import type { Message } from "@/lib/repositories/messages";
import type { CourseTopic, TopicProgress } from "@/lib/repositories/topics";
import type { CourseTest } from "@/lib/repositories/tests";
import type { StudyActivity, StudyDuration, StudyMode } from "@/lib/repositories/availability";
import type { PendingInvitation } from "@/lib/repositories/invitations";
import type {
  AppNotification,
  NotificationCategory,
  NotificationType,
} from "@/lib/repositories/notifications";
import type { EnrollmentWithCourse } from "@/lib/repositories/enrollments";
import type { ShellData } from "@/lib/app/queries";
import type { ActivityItem, DashboardCourse, DashboardData } from "@/lib/dashboard/queries";
import type { CourseDetailData, MemberStatus } from "@/lib/courses/detail-queries";
import type { RoomPageData } from "@/lib/rooms/queries";
import type {
  NotificationAction,
  NotificationItem,
  NotificationsData,
} from "@/lib/notifications/queries";
import type { AnalyticsData, AnalyticsRange } from "@/lib/analytics/queries";
import type { ProfileFormData } from "@/lib/profile/queries";
import type { StackPerson } from "@/components/ui/avatar-stack";

// Fixtures behind demo mode (see lib/demo/constants.ts). Three scenarios for
// the designer, per the brief:
//   active — people available right now, a live room, invitations, an event
//   quiet  — the same classmates, but nobody available and no rooms
//   empty  — the student is alone in their courses: 0 classmates, 0 rooms
// Every timestamp is relative to the request, so "לפני 3 דק׳" stays true.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Clock = { now: number; ago: (ms: number) => string; in: (ms: number) => string };

function clock(): Clock {
  const now = Date.now();
  return {
    now,
    ago: (ms) => new Date(now - ms).toISOString(),
    in: (ms) => new Date(now + ms).toISOString(),
  };
}

// An upcoming time on a round hour/quarter, so event cards read naturally.
function roundUp(iso: string, stepMinutes: number): string {
  const step = stepMinutes * MIN;
  return new Date(Math.ceil(new Date(iso).getTime() / step) * step).toISOString();
}

const avatar = (key: string) => `${DEMO_AVATAR_PREFIX}${key}.svg`;

// --- catalog -------------------------------------------------------------------

const INSTITUTION: Institution = {
  id: demoId(1, 1),
  name: "אוניברסיטת תל אביב",
  city: "תל אביב",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const FACULTIES: Faculty[] = [
  {
    id: demoId(1, 11),
    institution_id: INSTITUTION.id,
    name: "מדעים מדויקים",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: demoId(1, 12),
    institution_id: INSTITUTION.id,
    name: "הנדסה",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const DEP = { math: demoId(1, 21), cs: demoId(1, 22), ee: demoId(1, 23) };

const DEPARTMENTS: Department[] = [
  {
    id: DEP.math,
    institution_id: INSTITUTION.id,
    faculty_id: FACULTIES[0].id,
    name: "מתמטיקה",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: DEP.cs,
    institution_id: INSTITUTION.id,
    faculty_id: FACULTIES[0].id,
    name: "מדעי המחשב",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: DEP.ee,
    institution_id: INSTITUTION.id,
    faculty_id: FACULTIES[1].id,
    name: "הנדסת חשמל",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];
const DEPARTMENTS_BY_ID = new Map(DEPARTMENTS.map((d) => [d.id, d]));

const C = {
  infi: DEMO_INFI_COURSE_ID,
  intro: demoId(2, 2),
  linear: demoId(2, 3),
  ds: demoId(2, 4),
  prob: demoId(2, 5),
  logic: demoId(2, 6),
  digital: demoId(2, 7),
  infi2: demoId(2, 8),
};

function course(id: string, name: string, code: string, dep: string, year: number): Course {
  return {
    id,
    institution_id: INSTITUTION.id,
    department_id: dep,
    code,
    name,
    year_level: year,
    semester: "א",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const COURSES: Course[] = [
  course(C.infi, "אינפי 1", "0366-1101", DEP.math, 1),
  course(C.intro, "מבוא למדעי המחשב", "0368-1105", DEP.cs, 1),
  course(C.linear, "אלגברה לינארית", "0366-1111", DEP.math, 1),
  course(C.ds, "מבני נתונים", "0368-2158", DEP.cs, 2),
  course(C.prob, "הסתברות ושימושים", "0365-2301", DEP.math, 2),
  course(C.logic, "לוגיקה ותורת הקבוצות", "0366-1102", DEP.math, 1),
  course(C.digital, "מערכות ספרתיות", "0512-2541", DEP.ee, 2),
  course(C.infi2, "אינפי 2", "0366-1201", DEP.math, 1),
];
const COURSE_BY_ID = new Map(COURSES.map((c) => [c.id, c]));

const MY_COURSE_IDS = [C.infi, C.intro, C.linear];

// --- people ----------------------------------------------------------------------

const ME = {
  id: DEMO_USER_ID,
  full_name: "נועה כהן",
  avatar_url: avatar("me"),
  bio: "סטודנטית שנה ב׳ למדעי המחשב. אוהבת ללמוד בקבוצות קטנות ולהסביר לאחרים 🙂",
  department_id: DEP.cs,
  study_year: 2,
  city: "תל אביב",
};

// [key, name, department, year, city]
const PEOPLE_SEED = [
  ["p1", "יואב לוי", DEP.cs, 1, "תל אביב"],
  ["p2", "מאיה פרץ", DEP.math, 1, "רמת גן"],
  ["p3", "עומר ביטון", DEP.cs, 2, "חולון"],
  ["p4", "שירה אזולאי", DEP.math, 1, "תל אביב"],
  ["p5", "דניאל אברהם", DEP.ee, 2, "פתח תקווה"],
  ["p6", "תמר מזרחי", DEP.math, 2, "גבעתיים"],
  ["p7", "איתי שושן", DEP.cs, 1, "ראשון לציון"],
  ["p8", "רוני גולן", DEP.cs, 2, "תל אביב"],
  ["p9", "אדם חדד", DEP.cs, 2, "בת ים"],
  ["p10", "ליה בן דוד", DEP.math, 1, "הרצליה"],
  ["p11", "עידו קפלן", DEP.cs, 1, "רמת גן"],
  ["p12", "הדר רוזן", DEP.ee, 1, "תל אביב"],
  ["p13", "נדב פרידמן", DEP.cs, 2, "חולון"],
  ["p14", "גל שמעוני", DEP.cs, 3, "תל אביב"],
] as const;

type PersonKey = (typeof PEOPLE_SEED)[number][0];

const PERSON_ID = Object.fromEntries(
  PEOPLE_SEED.map(([key], i) => [key, demoId(0, 100 + i)]),
) as Record<PersonKey, string>;

// Who is "online" (last seen < 5 min) in the active scenario.
const ONLINE_IN_ACTIVE: PersonKey[] = ["p1", "p2", "p3", "p4", "p6", "p8", "p11", "p12"];

function people(scenario: DemoScenario, t: Clock): Map<string, PublicProfile> {
  return new Map(
    PEOPLE_SEED.map(([key, name, dep, year, city], i) => {
      const lastSeen =
        scenario === "active" && ONLINE_IN_ACTIVE.includes(key)
          ? t.ago((1 + (i % 3)) * MIN)
          : t.ago((1 + (i % 4)) * DAY + i * HOUR);
      const profile: PublicProfile = {
        id: PERSON_ID[key],
        full_name: name,
        avatar_url: avatar(key),
        institution_id: INSTITUTION.id,
        department_id: dep,
        study_year: year,
        city,
        last_seen_at: lastSeen,
      };
      return [profile.id, profile];
    }),
  );
}

function myPublicProfile(t: Clock): PublicProfile {
  return {
    id: ME.id,
    full_name: ME.full_name,
    avatar_url: ME.avatar_url,
    institution_id: INSTITUTION.id,
    department_id: ME.department_id,
    study_year: ME.study_year,
    city: ME.city,
    last_seen_at: t.ago(0),
  };
}

function myProfile(t: Clock): Profile {
  return {
    ...myPublicProfile(t),
    bio: ME.bio,
    role: "student",
    is_active: true,
    created_at: t.ago(40 * DAY),
    updated_at: t.ago(2 * DAY),
  };
}

// Other students per course. Infi 1 / Intro CS / Linear algebra match the
// brief: 8 / 10 / 6 students including the demo user.
const ROSTER: Record<string, PersonKey[]> = {
  [C.infi]: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
  [C.intro]: ["p1", "p3", "p8", "p9", "p10", "p11", "p12", "p13", "p14"],
  [C.linear]: ["p2", "p5", "p7", "p10", "p12"],
  [C.ds]: ["p1", "p3", "p8", "p9", "p10", "p11", "p13", "p14"],
  [C.prob]: ["p2", "p5", "p6", "p7", "p12"],
  [C.logic]: ["p2", "p4", "p6", "p10"],
  [C.digital]: ["p8", "p11", "p14"],
  [C.infi2]: ["p1", "p2", "p3", "p4", "p5", "p6"],
};

function roster(scenario: DemoScenario, courseId: string): string[] {
  if (scenario === "empty") return [];
  return (ROSTER[courseId] ?? []).map((k) => PERSON_ID[k]);
}

function studentCount(scenario: DemoScenario, courseId: string): number {
  const mine = MY_COURSE_IDS.includes(courseId) ? 1 : 0;
  return roster(scenario, courseId).length + mine;
}

// --- topics & progress -----------------------------------------------------------

const TOPIC_TITLES: Record<string, string[]> = {
  [C.infi]: [
    "מספרים ממשיים",
    "סדרות",
    "טורים",
    "גבולות של פונקציות",
    "רציפות",
    "נגזרות",
    "אינטגרלים",
  ],
  [C.intro]: [
    "משתנים וטיפוסים",
    "תנאים",
    "לולאות ומערכים",
    "פונקציות",
    "רקורסיה",
    "מיונים",
    "סיבוכיות",
  ],
  [C.linear]: [
    "מערכות משוואות",
    "מטריצות",
    "דטרמיננטות",
    "מרחבים וקטוריים",
    "העתקות לינאריות",
    "ערכים עצמיים",
  ],
};

const TOPICS: CourseTopic[] = Object.entries(TOPIC_TITLES).flatMap(([courseId, titles], ci) =>
  titles.map((title, i) => ({
    id: demoId(3, (ci + 1) * 100 + i + 1),
    course_id: courseId,
    position: i + 1,
    title,
  })),
);

function topicId(courseId: string, title: string): string | null {
  return TOPICS.find((t) => t.course_id === courseId && t.title === title)?.id ?? null;
}

// [course, mastered count, in-progress position, progress %]
const MY_PROGRESS: [string, number, number, number][] = [
  [C.infi, 3, 4, 52],
  [C.intro, 2, 3, 38],
  [C.linear, 1, 2, 24],
];

function topicProgress(scenario: DemoScenario, t: Clock): TopicProgress[] {
  if (scenario === "empty") return [];
  return MY_PROGRESS.flatMap(([courseId, mastered, current]) =>
    TOPICS.filter((topic) => topic.course_id === courseId && topic.position <= current).map(
      (topic) => ({
        topic_id: topic.id,
        status: topic.position <= mastered ? ("mastered" as const) : ("in_progress" as const),
        updated_at: t.ago(topic.position * DAY),
      }),
    ),
  );
}

function enrollments(scenario: DemoScenario, t: Clock): EnrollmentWithCourse[] {
  return MY_PROGRESS.map(([courseId, , , percent], i) => ({
    id: demoId(4, i + 1),
    user_id: ME.id,
    course_id: courseId,
    status: "active" as const,
    progress_percent: scenario === "empty" ? 0 : percent,
    completed_at: null,
    created_at: t.ago(30 * DAY),
    course: COURSE_BY_ID.get(courseId)!,
  }));
}

// --- availability ("פנויים ללמוד עכשיו") ----------------------------------------

type DemoAvailability = {
  person: PersonKey;
  courseId: string;
  mode: StudyMode;
  duration: StudyDuration;
  activity: StudyActivity;
  topic: string;
};

// Infi 1: 3 available · Intro CS: 2 · Linear algebra: 1 (the brief).
const AVAILABILITY: DemoAvailability[] = [
  {
    person: "p2",
    courseId: C.infi,
    mode: "online",
    duration: 60,
    activity: "review",
    topic: "גבולות של פונקציות",
  },
  {
    person: "p3",
    courseId: C.infi,
    mode: "campus",
    duration: 90,
    activity: "exercises",
    topic: "נגזרות",
  },
  {
    person: "p6",
    courseId: C.infi,
    mode: "online",
    duration: 30,
    activity: "exam_prep",
    topic: "רציפות",
  },
  {
    person: "p8",
    courseId: C.intro,
    mode: "campus",
    duration: 120,
    activity: "exercises",
    topic: "רקורסיה",
  },
  {
    person: "p11",
    courseId: C.intro,
    mode: "online",
    duration: 60,
    activity: "summaries",
    topic: "לולאות ומערכים",
  },
  {
    person: "p12",
    courseId: C.linear,
    mode: "online",
    duration: 90,
    activity: "exam_prep",
    topic: "דטרמיננטות",
  },
];

function availability(scenario: DemoScenario, courseId?: string): DemoAvailability[] {
  if (scenario !== "active") return [];
  return AVAILABILITY.filter((a) => !courseId || a.courseId === courseId);
}

// --- rooms -----------------------------------------------------------------------

const R = {
  live: DEMO_LIVE_ROOM_ID,
  recursion: demoId(5, 2),
  open: demoId(5, 3),
  invited: demoId(5, 4),
};

function room(
  t: Clock,
  id: string,
  courseId: string,
  createdBy: string,
  name: string,
  topic: string,
  lastMessageAgo: number,
  createdAgo: number,
  isOpen = false,
): Room {
  return {
    id,
    course_id: courseId,
    created_by: createdBy,
    name,
    topic,
    status: "active",
    ai_enabled: true,
    is_open: isOpen,
    last_message_at: t.ago(lastMessageAgo),
    created_at: t.ago(createdAgo),
    archived_at: null,
    archived_by: null,
    archived_by_admin: false,
  };
}

function myRooms(scenario: DemoScenario, t: Clock): Room[] {
  if (scenario !== "active") return [];
  return [
    room(
      t,
      R.live,
      C.infi,
      ME.id,
      "חזרה לבוחן — גבולות ורציפות",
      "גבולות ורציפות · גיליון 5",
      3 * MIN,
      70 * MIN,
    ),
    room(
      t,
      R.recursion,
      C.intro,
      PERSON_ID.p9,
      "תרגיל בית 3 — רקורסיה",
      "רקורסיה",
      2 * HOUR,
      DAY + 3 * HOUR,
    ),
  ];
}

const ROOM_MEMBERS: Record<string, { owner: string; members: string[] }> = {
  [R.live]: { owner: ME.id, members: [PERSON_ID.p1, PERSON_ID.p2, PERSON_ID.p4] },
  [R.recursion]: { owner: PERSON_ID.p9, members: [ME.id, PERSON_ID.p13] },
};

// Online in the room header (realtime presence is off in demo mode).
const ROOM_PRESENCE: Record<string, string[]> = {
  [R.live]: [ME.id, PERSON_ID.p1, PERSON_ID.p2, PERSON_ID.p4],
  [R.recursion]: [ME.id],
};

function openRooms(scenario: DemoScenario, t: Clock): OpenRoom[] {
  if (scenario !== "active") return [];
  return [
    {
      room_id: R.open,
      course_id: C.linear,
      name: "מטריצות הפיכות",
      topic: "מטריצות",
      created_by: PERSON_ID.p7,
      creator_name: "איתי שושן",
      member_count: 2,
      is_member: false,
      last_message_at: t.ago(15 * MIN),
      created_at: t.ago(20 * MIN),
    },
  ];
}

function roomCount(scenario: DemoScenario, courseId: string): number {
  if (scenario !== "active") return 0;
  const counts: Record<string, number> = {
    [C.infi]: 1,
    [C.intro]: 1,
    [C.linear]: 2,
    [C.ds]: 2,
    [C.infi2]: 1,
  };
  return counts[courseId] ?? 0;
}

const INVITATION_ID = demoId(7, 1);

function pendingInvitations(scenario: DemoScenario, t: Clock): PendingInvitation[] {
  if (scenario !== "active") return [];
  return [
    {
      id: INVITATION_ID,
      room_id: R.invited,
      room_name: "הכנה למבחן באלגברה",
      room_topic: "דטרמיננטות",
      course_id: C.linear,
      course_name: "אלגברה לינארית",
      course_code: "0366-1111",
      inviter_id: PERSON_ID.p5,
      inviter_name: "דניאל אברהם",
      inviter_avatar_url: avatar("p5"),
      expires_at: t.in(6 * DAY + 20 * HOUR),
      created_at: t.ago(8 * MIN),
    },
  ];
}

// --- events ----------------------------------------------------------------------

const E = {
  session: demoId(8, 1),
  midterm: demoId(8, 2),
  workshop: demoId(8, 3),
  linearExam: demoId(8, 4),
};

function events(scenario: DemoScenario, t: Clock): CourseTest[] {
  if (scenario === "empty") return [];
  const event = (
    id: string,
    courseId: string,
    kind: CourseTest["kind"],
    title: string,
    dueAt: string,
    location: string | null,
    description: string | null,
    createdBy: string,
  ): CourseTest => ({
    id,
    kind,
    location,
    course_id: courseId,
    title,
    description,
    due_at: dueAt,
    created_by: createdBy,
    is_active: true,
    created_at: t.ago(3 * DAY),
  });
  const tests = [
    event(
      E.midterm,
      C.infi,
      "test",
      "בוחן אמצע",
      roundUp(t.in(5 * DAY), 60),
      "בניין שרייבר, אולם 006",
      null,
      PERSON_ID.p4,
    ),
    event(
      E.linearExam,
      C.linear,
      "test",
      "מבחן מועד א׳",
      roundUp(t.in(18 * DAY), 60),
      null,
      null,
      PERSON_ID.p2,
    ),
  ];
  if (scenario !== "active") return tests;
  return [
    // "A future study session that is already scheduled" — starts within the hour.
    event(
      E.session,
      C.infi,
      "study_session",
      "מפגש חזרה — גבולות ורציפות",
      roundUp(t.in(50 * MIN), 15),
      "ספריית מדעים, חדר 204",
      "עוברים יחד על גיליון 5 לקראת הבוחן",
      ME.id,
    ),
    event(
      E.workshop,
      C.intro,
      "workshop",
      "סדנת דיבאגינג בפייתון",
      roundUp(t.in(2 * DAY), 60),
      "זום",
      null,
      PERSON_ID.p14,
    ),
    ...tests,
  ].sort((a, b) => a.due_at!.localeCompare(b.due_at!));
}

const SESSION_REGISTERED: PersonKey[] = ["p1", "p2", "p4", "p6"];

function registrations(scenario: DemoScenario, eventId: string): string[] {
  if (scenario !== "active" || eventId !== E.session) return [];
  return [ME.id, ...SESSION_REGISTERED.map((k) => PERSON_ID[k])];
}

// --- notifications -----------------------------------------------------------------

const CATEGORY: Record<NotificationType, NotificationCategory> = {
  room_invitation: "invitations",
  room_opened: "rooms",
  room_joined: "rooms",
  event_scheduled: "courses",
  course_recommendation: "courses",
  system: "system",
};

function notifications(scenario: DemoScenario, t: Clock): AppNotification[] {
  if (scenario === "empty") return [];
  let n = 0;
  const make = (
    type: NotificationType,
    agoMs: number,
    read: boolean,
    title: string,
    body: string | null,
    refs: Partial<
      Pick<AppNotification, "actor_id" | "course_id" | "room_id" | "invitation_id" | "event_id">
    > = {},
  ): AppNotification => ({
    id: demoId(9, ++n),
    user_id: ME.id,
    type,
    category: CATEGORY[type],
    actor_id: null,
    course_id: null,
    room_id: null,
    invitation_id: null,
    event_id: null,
    ...refs,
    title,
    body,
    read_at: read ? t.ago(agoMs - MIN) : null,
    created_at: t.ago(agoMs),
  });

  const welcome = make(
    "system",
    3 * DAY,
    true,
    "ברוכה הבאה ל-StuGether!",
    "סמני זמינות בקורס כדי שאחרים יוכלו להצטרף אלייך ללמידה.",
  );
  if (scenario === "quiet") return [welcome];

  const session = events(scenario, t).find((e) => e.id === E.session)!;
  const sessionMinutes = Math.round((new Date(session.due_at!).getTime() - t.now) / MIN);
  return [
    make(
      "event_scheduled",
      4 * MIN,
      false,
      `מפגש החזרה באינפי 1 מתחיל בעוד ${sessionMinutes} דק׳`,
      "ספריית מדעים, חדר 204 · 5 רשומים",
      { course_id: C.infi, event_id: E.session },
    ),
    make(
      "room_invitation",
      8 * MIN,
      false,
      "דניאל אברהם הזמין אותך ללמוד יחד",
      'חדר "הכנה למבחן באלגברה" · אלגברה לינארית',
      {
        actor_id: PERSON_ID.p5,
        course_id: C.linear,
        room_id: R.invited,
        invitation_id: INVITATION_ID,
      },
    ),
    make(
      "room_opened",
      20 * MIN,
      false,
      "איתי שושן פתח חדר לימוד באלגברה לינארית",
      "מטריצות הפיכות · 2/4 משתתפים",
      { actor_id: PERSON_ID.p7, course_id: C.linear, room_id: R.open },
    ),
    make(
      "room_joined",
      62 * MIN,
      false,
      "מאיה פרץ אישרה את ההזמנה והצטרפה לחדר",
      "חזרה לבוחן — גבולות ורציפות",
      { actor_id: PERSON_ID.p2, course_id: C.infi, room_id: R.live },
    ),
    make("room_joined", 65 * MIN, true, "שירה אזולאי הצטרפה לחדר", "חזרה לבוחן — גבולות ורציפות", {
      actor_id: PERSON_ID.p4,
      course_id: C.infi,
      room_id: R.live,
    }),
    make(
      "room_invitation",
      DAY + 2 * HOUR,
      true,
      'אדם חדד הזמין אותך לחדר "תרגיל בית 3 — רקורסיה"',
      "מבוא למדעי המחשב",
      { actor_id: PERSON_ID.p9, course_id: C.intro, room_id: R.recursion },
    ),
    make(
      "course_recommendation",
      DAY + 5 * HOUR,
      true,
      "מבני נתונים מתאים לך",
      "8 סטודנטים מהקורסים שלך כבר לומדים שם",
      { course_id: C.ds },
    ),
    welcome,
  ];
}

// --- messages (the live room) --------------------------------------------------------

const AI_LIMIT_ANSWER = `שאלה מצוינת! במקום לשנן — בואו נראה את זה:

1. במעגל היחידה, \`x\` הוא **אורך הקשת** ו-\`sin(x)\` הוא **הגובה** של הנקודה על המעגל.
2. כש-\`x\` קטן מאוד — מה קורה להפרש בין אורך הקשת לבין הגובה?
3. השוואת שטחים (משולש פנימי, גזרה, משולש חיצוני) נותנת \`sin(x) ≤ x ≤ tan(x)\`.

**כיוון להמשך:** חלקו את אי-השוויון ב-\`sin(x)\` ונסו להפעיל את **משפט הסנדוויץ'**. מה יוצא לכם?`;

const AI_LHOPITAL_ANSWER = `כלל אצבע שעוזר:

- **קודם** בדקו אם מניפולציה קטנה מביאה אתכם לגבול ידוע, כמו \`sin(x)/x\`.
- **לופיטל** מתאים לצורה \`0/0\` או \`∞/∞\` — *וכשהנגזרות פשוטות יותר מהפונקציה עצמה*.
- אם אחרי גזירה אחת הביטוי רק מסתבך, זה סימן לחזור לגבולות הידועים.

רוצים לנסות יחד על תרגיל 6? כתבו איזו צורה קיבלתם בהצבה ונמשיך משם 🙂`;

const AI_RECURSION_ANSWER = `נסו לענות על שתי שאלות לפני שכותבים קוד:

1. **מקרה הבסיס:** מה הקלט הכי קטן שהתשובה עליו ידועה מיד?
2. **צעד הרקורסיה:** אם הפונקציה כבר יודעת לפתור עבור \`n-1\`, איך משתמשים בזה עבור \`n\`?

כתבו לי את התשובות שלכם ואעזור לבדוק אותן.`;

type Line = [sender: string | "ai" | "system", minutesAgo: number, content: string];

function threadLines(roomId: string): Line[] {
  const { p1, p2, p4, p9, p13 } = PERSON_ID;
  if (roomId === R.live) {
    return [
      ["system", 70, "נועה כהן פתחה את החדר"],
      ["system", 65, "שירה אזולאי הצטרפה לחדר"],
      ["system", 62, "מאיה פרץ הצטרפה לחדר"],
      [p1, 58, "היי! מי מגיע לבוחן ביום ראשון? אני עדיין מסתבך עם גבולות באינסוף 😅"],
      [
        p2,
        55,
        '📄 העליתי לתיקיית הקורס את הסיכום שלי מהרצאה 6 — "גבולות ורציפות" (12 עמ׳). יש שם את כל המשפטים עם הוכחות קצרות',
      ],
      [ME.id, 52, "מעולה, תודה מאיה! בואו נתחיל מתרגיל 4 בגיליון 5, זה עם sin(x)/x"],
      [p4, 49, "רגע, למה הגבול של sin(x)/x כש-x שואף ל-0 הוא 1? אני תמיד שוכחת את ההסבר"],
      [p1, 47, "@AI אפשר הסבר אינטואיטיבי למה lim sin(x)/x = 1?"],
      ["ai", 46, AI_LIMIT_ANSWER],
      [p4, 41, "וואו, עם מעגל היחידה זה הרבה יותר ברור. תודה!"],
      [p2, 14, "בתרגיל 4 יצא לי 3/2. למישהו יצא אחרת?"],
      [ME.id, 11, "גם לי 3/2 👍 הכפלתי ב-3x/3x והגעתי לגבול הידוע"],
      [p1, 7, "@AI איך יודעים מתי להשתמש בלופיטל ומתי בגבולות ידועים?"],
      ["ai", 6, AI_LHOPITAL_ANSWER],
      [p4, 3, "נפגשים עוד מעט בספרייה למפגש החזרה? נרשמתי 🙂"],
    ];
  }
  if (roomId === R.recursion) {
    return [
      ["system", 27 * 60, "אדם חדד פתח את החדר"],
      [p9, 26 * 60, "מישהו הבין את סעיף ב׳ בתרגיל 3? הפונקציה שלי נכנסת ללולאה אינסופית"],
      [p13, 25 * 60, "@AI איך מתחילים לחשוב על פתרון רקורסיבי?"],
      ["ai", 25 * 60 - 1, AI_RECURSION_ANSWER],
      [ME.id, 4 * 60, "שכחתי את מקרה הבסיס כש-n=0 🙈 עכשיו זה עובד"],
      [p9, 3 * 60, "גם אצלי! ומה עם סעיף ג׳, עם הפלינדרומים?"],
      [p13, 2 * 60 + 30, "השוויתי תו ראשון ואחרון ואז קריאה על המחרוזת בלי שניהם"],
      [p9, 2 * 60, "גאוני, תודה! נמשיך מחר?"],
    ];
  }
  return [];
}

function roomMessages(roomId: string, t: Clock): Message[] {
  return threadLines(roomId).map(([sender, minutesAgo, content], i) => ({
    id: demoId(6, i + 1 + (roomId === R.live ? 0 : 500)),
    room_id: roomId,
    sender_id: sender === "ai" || sender === "system" ? null : sender,
    sender_type: sender === "ai" ? "ai" : sender === "system" ? "system" : "user",
    content,
    status: "complete",
    ai_run_id: null,
    metadata: {},
    created_at: t.ago(minutesAgo * MIN),
    deleted_at: null,
  }));
}

// --- page builders -------------------------------------------------------------------

function stack(p: PublicProfile | undefined): StackPerson | null {
  return p ? { id: p.id, name: p.full_name } : null;
}

function stackAll(ids: string[], byId: Map<string, PublicProfile>): StackPerson[] {
  return ids.map((id) => stack(byId.get(id))).filter((p): p is StackPerson => p !== null);
}

function unreadCount(scenario: DemoScenario, t: Clock): number {
  return notifications(scenario, t).filter((n) => n.read_at === null).length;
}

export function demoShell(scenario: DemoScenario): ShellData {
  const t = clock();
  const rooms = myRooms(scenario, t);
  return {
    userId: ME.id,
    fullName: ME.full_name,
    avatarPath: ME.avatar_url,
    unreadNotifications: unreadCount(scenario, t),
    activeRoomId: rooms.find((r) => isRoomLive(r, t.now))?.id ?? null,
    isSuperAdmin: false,
  };
}

export function demoDashboard(scenario: DemoScenario): DashboardData {
  const t = clock();
  const byId = people(scenario, t);
  const enrolled = enrollments(scenario, t);
  const rooms = myRooms(scenario, t);
  const open = openRooms(scenario, t);
  const progress = topicProgress(scenario, t);
  const allEvents = events(scenario, t);
  const notes = notifications(scenario, t);

  const roomByCourse = new Map(rooms.map((r) => [r.course_id, r]));
  const openByCourse = new Map(open.map((r) => [r.course_id, r]));
  const testSoon = new Set(
    allEvents
      .filter((e) => e.kind === "test" && new Date(e.due_at!).getTime() - t.now < 7 * DAY)
      .map((e) => e.course_id),
  );
  const continueHref = (courseId: string) => {
    const r = roomByCourse.get(courseId);
    return r ? `/rooms/${r.id}` : `/courses/${courseId}`;
  };

  const ordered = [...enrolled].sort((a, b) => b.progress_percent - a.progress_percent);
  const myCourses: DashboardCourse[] = ordered.map((e) => {
    const learners = availability(scenario, e.course_id).length;
    const r = roomByCourse.get(e.course_id);
    let badge: DashboardCourse["badge"] = null;
    if ((r && isRoomLive(r, t.now)) || openByCourse.has(e.course_id)) badge = { kind: "live" };
    else if (testSoon.has(e.course_id)) badge = { kind: "test" };
    else if (learners > 0) badge = { kind: "learners", count: learners };
    return {
      id: e.course_id,
      name: e.course.name,
      code: e.course.code,
      progress: e.progress_percent,
      completed: false,
      badge,
      people: stackAll(roster(scenario, e.course_id), byId),
      continueHref: continueHref(e.course_id),
    };
  });

  const heroEnrollment = ordered[0];
  const summary = summarizeTopics(
    TOPICS.filter((x) => x.course_id === heroEnrollment.course_id),
    progress,
  );
  const hero: DashboardData["hero"] = {
    courseId: heroEnrollment.course_id,
    name: heroEnrollment.course.name,
    code: heroEnrollment.course.code,
    progress: heroEnrollment.progress_percent,
    topics: summary.topics,
    total: summary.total,
    mastered: summary.mastered,
    currentTopic: summary.current?.title ?? null,
    currentIndex: summary.currentIndex,
    availableNow: stackAll(
      availability(scenario, heroEnrollment.course_id).map((a) => PERSON_ID[a.person]),
      byId,
    ),
    continueHref: continueHref(heroEnrollment.course_id),
    myRoomId: roomByCourse.get(heroEnrollment.course_id)?.id ?? null,
    openRoomId: openByCourse.get(heroEnrollment.course_id)?.room_id ?? null,
  };

  const partnerIds = [...new Set(MY_COURSE_IDS.flatMap((id) => roster(scenario, id)))];
  const avgProgress = Math.round(
    enrolled.reduce((s, e) => s + e.progress_percent, 0) / enrolled.length,
  );

  const me = myProfile(t);
  const recommendations = COURSES.filter((c) => !MY_COURSE_IDS.includes(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      departmentId: c.department_id,
      students: studentCount(scenario, c.id),
      match: computeCourseMatch(me, c, DEPARTMENTS_BY_ID, roomCount(scenario, c.id)),
    }))
    .sort((a, b) => b.match - a.match || b.students - a.students);

  const joinable = new Set(open.map((r) => r.room_id));
  const activity: ActivityItem[] = notes.slice(0, 4).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    unread: n.read_at === null,
    actor: n.actor_id ? stack(byId.get(n.actor_id)) : null,
    joinRoomId: n.type === "room_opened" && n.room_id && joinable.has(n.room_id) ? n.room_id : null,
  }));

  const next = allEvents.find((e) => new Date(e.due_at!).getTime() > t.now) ?? null;
  const registered = next ? registrations(scenario, next.id) : [];

  const unreadByRoom: Record<string, number> = { [R.live]: 0, [R.recursion]: 3 };
  const messagesThisWeek = scenario === "active" ? 23 : 0;

  return {
    needsOnboarding: false,
    firstName: ME.full_name.split(" ")[0],
    streak: scenario === "active" ? 6 : 0,
    messagesThisWeek,
    hero,
    stats: {
      activeCourses: enrolled.length,
      courseBars: ordered.map((e) => e.progress_percent),
      activeRooms: rooms.length,
      liveRooms: rooms.filter((r) => isRoomLive(r, t.now)).length,
      partners: partnerIds.length,
      partnerPeople: stackAll(partnerIds, byId),
      avgProgress,
    },
    myCourses,
    departments: DEPARTMENTS.map((d) => ({ id: d.id, name: d.name })),
    recommendations,
    activity,
    unreadCount: notes.filter((n) => n.read_at === null).length,
    nextEvent: next
      ? {
          id: next.id,
          courseId: next.course_id,
          title: next.title,
          kind: next.kind,
          dueAt: next.due_at!,
          registered: stackAll(
            registered.filter((id) => id !== ME.id),
            byId,
          ),
          registeredCount: registered.length,
        }
      : null,
    rooms: rooms
      .map((r) => ({
        id: r.id,
        name: r.name,
        courseName: COURSE_BY_ID.get(r.course_id)?.name ?? null,
        status: r.status,
        unread: unreadByRoom[r.id] ?? 0,
        lastMessageAt: r.last_message_at,
        live: isRoomLive(r, t.now),
      }))
      .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")),
    pendingInvitations: pendingInvitations(scenario, t).map((i) => ({
      id: i.id,
      roomName: i.room_name,
      courseName: i.course_name,
      inviter: { id: i.inviter_id, name: i.inviter_name },
      expiresAt: i.expires_at,
    })),
    roomCourses: enrolled.map((e) => ({ id: e.course_id, name: e.course.name })),
  };
}

// Raw catalog for the courses page; lib/courses/queries.ts filters and sorts
// it with the same code as the real catalog.
export function demoCatalog(scenario: DemoScenario) {
  return {
    institutionId: INSTITUTION.id,
    courses: COURSES,
    departments: DEPARTMENTS,
    favoriteIds: scenario === "empty" ? [] : [C.infi, C.ds],
    studentCounts: Object.fromEntries(COURSES.map((c) => [c.id, studentCount(scenario, c.id)])),
    roomCounts: Object.fromEntries(COURSES.map((c) => [c.id, roomCount(scenario, c.id)])),
  };
}

export function demoCourseDetail(scenario: DemoScenario, courseId: string): CourseDetailData {
  const t = clock();
  const c = COURSE_BY_ID.get(courseId) ?? null;
  const byId = people(scenario, t);
  const me = myPublicProfile(t);
  const isEnrolled = MY_COURSE_IDS.includes(courseId);
  const others = roster(scenario, courseId)
    .map((id) => byId.get(id))
    .filter((p): p is PublicProfile => !!p);
  const available = isEnrolled ? availability(scenario, courseId) : [];
  const availableIds = new Set(available.map((a) => PERSON_ID[a.person]));

  const rank = { available: 0, online: 1, offline: 2 } as const;
  const members = isEnrolled
    ? others
        .map((p) => {
          const status: MemberStatus = availableIds.has(p.id)
            ? "available"
            : isOnline(p.last_seen_at, t.now)
              ? "online"
              : "offline";
          return { profile: p, status };
        })
        .sort(
          (a, b) =>
            rank[a.status] - rank[b.status] ||
            a.profile.full_name.localeCompare(b.profile.full_name, "he"),
        )
    : [];

  const courseEvents = events(scenario, t).filter(
    (e) => e.course_id === courseId && new Date(e.due_at!).getTime() > t.now,
  );
  const next = courseEvents[0] ?? null;
  const registered = next && isEnrolled ? registrations(scenario, next.id) : [];
  const enrollment = enrollments(scenario, t).find((e) => e.course_id === courseId);

  return {
    course: c,
    departmentName: c?.department_id
      ? (DEPARTMENTS_BY_ID.get(c.department_id)?.name ?? null)
      : null,
    isEnrolled,
    isFavorite: demoCatalog(scenario).favoriteIds.includes(courseId),
    progressPercent: enrollment?.progress_percent ?? 0,
    studentCount: studentCount(scenario, courseId),
    activeRoomCount: roomCount(scenario, courseId),
    myRoomsForCourse: myRooms(scenario, t).filter((r) => r.course_id === courseId),
    joinableOpenRooms: isEnrolled
      ? openRooms(scenario, t).filter((r) => r.course_id === courseId)
      : [],
    topics: summarizeTopics(
      TOPICS.filter((x) => x.course_id === courseId),
      topicProgress(scenario, t),
    ),
    availableNow: available.map((a) => ({
      profile: byId.get(PERSON_ID[a.person])!,
      mode: a.mode,
      durationMinutes: a.duration,
      activity: a.activity,
      topicTitle: topicId(courseId, a.topic) ? a.topic : null,
    })),
    myAvailability: null,
    members,
    classmates: others
      .map((p) => ({ profile: p, match: computeMatchPercent(me, p, DEPARTMENTS_BY_ID) }))
      .sort((a, b) => b.match.percent - a.match.percent),
    upcomingEvents: courseEvents,
    nextEvent: next
      ? {
          ...next,
          registeredCount: registered.length,
          isRegistered: registered.includes(ME.id),
        }
      : null,
  };
}

export function demoRoom(scenario: DemoScenario, roomId: string): RoomPageData | null {
  const t = clock();
  const r = myRooms(scenario, t).find((x) => x.id === roomId);
  if (!r) return null;
  const byId = people(scenario, t);
  const me = myPublicProfile(t);
  const { owner, members } = ROOM_MEMBERS[r.id];
  const memberIds = [owner, ...members];
  const roomMembers: RoomMember[] = memberIds.map((id, i) => ({
    room_id: r.id,
    user_id: id,
    role: id === owner ? "owner" : "member",
    joined_at: t.ago(70 * MIN - i * 3 * MIN),
    left_at: null,
    last_read_at: t.ago(MIN),
    profile: id === ME.id ? me : (byId.get(id) ?? null),
  }));
  const candidates = roster(scenario, r.course_id)
    .filter((id) => !memberIds.includes(id))
    .map((id) => byId.get(id)!)
    .map((p) => ({ id: p.id, name: p.full_name, avatarPath: p.avatar_url }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return {
    room: r,
    course: COURSE_BY_ID.get(r.course_id) ?? null,
    members: roomMembers,
    messages: roomMessages(r.id, t),
    hasMoreMessages: false,
    isMember: true,
    isOwner: owner === ME.id,
    aiAvailable: true,
    globalAiEnabled: true,
    invitations: [],
    inviteCandidates: candidates,
    openSeats: Math.max(0, 4 - memberIds.length),
    demoPresence: ROOM_PRESENCE[r.id] ?? [ME.id],
  };
}

export function demoNotifications(
  scenario: DemoScenario,
  category: NotificationCategory | null,
): NotificationsData {
  const t = clock();
  const all = notifications(scenario, t);
  const invitations = new Map(pendingInvitations(scenario, t).map((i) => [i.id, i]));
  const mine = new Set(myRooms(scenario, t).map((r) => r.id));
  const joinable = new Set(openRooms(scenario, t).map((r) => r.room_id));

  const items: NotificationItem[] = all
    .filter((n) => !category || n.category === category)
    .map((n) => {
      let action: NotificationAction = null;
      if (n.type === "room_invitation" && n.invitation_id && invitations.has(n.invitation_id)) {
        action = { kind: "invitation", invitation: invitations.get(n.invitation_id)! };
      } else if (n.room_id && mine.has(n.room_id)) {
        action = { kind: "room", roomId: n.room_id };
      } else if (n.type === "room_opened" && n.room_id && joinable.has(n.room_id)) {
        action = { kind: "join", roomId: n.room_id };
      } else if (n.type === "event_scheduled" && n.course_id) {
        action = { kind: "course", courseId: n.course_id, label: "צפייה" };
      } else if (n.type === "course_recommendation" && n.course_id) {
        action = { kind: "course", courseId: n.course_id, label: "לקורס" };
      }
      return { ...n, action };
    });

  const today = israelDayKey(new Date(t.now));
  const yesterday = israelDayKey(new Date(t.now - DAY));
  const groups: NotificationsData["groups"] = [
    { label: "היום", items: [] },
    { label: "אתמול", items: [] },
    { label: "מוקדם יותר", items: [] },
  ];
  for (const item of items) {
    const key = israelDayKey(new Date(item.created_at));
    groups[key === today ? 0 : key === yesterday ? 1 : 2].items.push(item);
  }

  const categories: NotificationCategory[] = ["invitations", "rooms", "courses", "system"];
  const count = (list: AppNotification[], c: NotificationCategory) =>
    list.filter((n) => n.category === c).length;
  const week = all.filter((n) => t.now - new Date(n.created_at).getTime() < 7 * DAY);

  return {
    groups: groups.filter((g) => g.items.length > 0),
    counts: {
      all: all.length,
      ...Object.fromEntries(categories.map((c) => [c, count(all, c)])),
    } as NotificationsData["counts"],
    unread: all.filter((n) => n.read_at === null).length,
    week: {
      total: week.length,
      byCategory: Object.fromEntries(
        categories.map((c) => [c, count(week, c)]),
      ) as NotificationsData["week"]["byCategory"],
    },
    preferences: {
      live_rooms: true,
      messages_invites: true,
      course_recs: false,
      system_updates: true,
    },
  };
}

export function demoAnalytics(scenario: DemoScenario, range: AnalyticsRange): AnalyticsData {
  const t = clock();
  const weeks = range === "semester" ? 20 : 8;
  const since = t.now - weeks * 7 * DAY;
  const enrolled = enrollments(scenario, t);
  const pattern =
    scenario === "active"
      ? [3, 5, 4, 8, 6, 11, 9, 14, 7, 12, 10, 15, 13, 9, 16, 12, 18, 14, 17, 23]
      : scenario === "quiet"
        ? [2, 4, 3, 5, 2, 3, 1, 0, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2, 0, 0]
        : [];
  const weekly = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(since + i * 7 * DAY).toISOString(),
    count: pattern[pattern.length - weeks + i] ?? 0,
  }));
  const messagesSent = weekly.reduce((s, w) => s + w.count, 0);
  const rooms = myRooms(scenario, t);
  const bySubject = new Map<string, number>();
  for (const e of enrolled) {
    const name = DEPARTMENTS_BY_ID.get(e.course.department_id ?? "")?.name ?? "אחר";
    bySubject.set(name, (bySubject.get(name) ?? 0) + 1);
  }
  const avgActiveProgress = Math.round(
    enrolled.reduce((s, e) => s + e.progress_percent, 0) / enrolled.length,
  );

  return {
    range,
    weeks,
    activeCourses: enrolled,
    completedCourses: [],
    enrolledCount: enrolled.length,
    activeRoomsCount: rooms.length,
    messagesSent,
    avgActiveProgress,
    weekly,
    courseProgress: [...enrolled]
      .sort((a, b) => b.progress_percent - a.progress_percent)
      .map((e) => ({
        id: e.course_id,
        name: e.course.name,
        progress: e.progress_percent,
        completed: false,
      })),
    subjects: [...bySubject.entries()].map(([name, count]) => ({ name, count })),
    achievements: [
      { title: "צעד ראשון", description: "הצטרפות לחדר ראשון", earned: rooms.length > 0 },
      {
        title: "מוביל/ה",
        description: "פתחת חדר לימוד",
        earned: rooms.some((r) => r.created_by === ME.id),
      },
      { title: "חברותי/ת", description: "10 הודעות ומעלה", earned: messagesSent >= 10 },
      { title: "סיום קורס", description: "השלמת קורס מלא", earned: false },
    ],
  };
}

export function demoProfileForm(scenario: DemoScenario): ProfileFormData {
  const t = clock();
  const enrolled = enrollments(scenario, t);
  const partners = new Set(MY_COURSE_IDS.flatMap((id) => roster(scenario, id))).size;
  return {
    profile: myProfile(t),
    institutions: [INSTITUTION],
    faculties: FACULTIES,
    departments: DEPARTMENTS,
    activeCourses: enrolled.map((e) => ({
      ...e.course,
      progress: e.progress_percent,
      completed: false,
    })),
    stats: { courses: enrolled.length, partners, streak: scenario === "active" ? 6 : 0 },
  };
}
