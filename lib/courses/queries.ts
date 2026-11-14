import "server-only";
import { getCachedOwnProfile } from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import { getCatalogCounts, listActiveCourses, listDepartments } from "@/lib/repositories/catalog";
import { listFavoriteCourseIds } from "@/lib/repositories/favorites";
import { listCourseRosters, listMyEnrollments } from "@/lib/repositories/enrollments";
import { listCourseTopics, listMyTopicProgress } from "@/lib/repositories/topics";
import { listUpcomingTestsForCourses } from "@/lib/repositories/tests";
import { listPublicProfiles } from "@/lib/repositories/profiles";
import { summarizeTopics } from "@/lib/courses/topic-state";
import { timed } from "@/lib/perf/timing";
import { getDemoScenario } from "@/lib/demo/state";
import { demoCatalog } from "@/lib/demo/fixtures";
import { semesterLabel, yearLabel } from "@/lib/ui/labels";
import type { Course, Department } from "@/lib/repositories/catalog";
import type { EnrollmentWithCourse } from "@/lib/repositories/enrollments";
import type { CourseTopic, TopicProgress } from "@/lib/repositories/topics";
import type { CourseTest } from "@/lib/repositories/tests";

// "קורסים" per the Figma (Change Request 07.11.2026): "הקורסים שלי" and
// "כל הקורסים" as course cards with progress, classmates and a status badge.

// "מבחן קרוב" was dropped (client QA 11.2026): exam dates exist only when a
// student adds them, so the sort looked broken. Replaced by two counts we have.
export type CourseSort = "relevance" | "progress" | "students" | "rooms" | "az" | "semester";
export type CourseView = "all" | "mine" | "favorites";

// Within one department the default is the degree's study plan (by year and
// semester); across departments it is relevance (activity).
export function parseCourseSort(value: string | undefined, departmentId?: string): CourseSort {
  if (
    value === "relevance" ||
    value === "progress" ||
    value === "students" ||
    value === "rooms" ||
    value === "az"
  ) {
    return value;
  }
  if (value === "semester" && departmentId) return "semester";
  // Older links: ?sort=popular, ?sort=exam.
  if (value === "popular") return "students";
  if (value === "exam") return "relevance";
  return departmentId ? "semester" : "relevance";
}

// ?view=mine / ?view=favorites (and the older ?favorites=1).
export function parseCourseView(view: string | undefined, favorites?: string): CourseView {
  if (view === "mine" || view === "favorites") return view;
  return favorites === "1" ? "favorites" : "all";
}

const SEMESTER_ORDER = ["סמסטר א׳", "סמסטר ב׳", "סמסטר קיץ"];
const semesterRank = (s: string | null) => {
  const i = SEMESTER_ORDER.indexOf(semesterLabel(s) ?? "");
  return i < 0 ? SEMESTER_ORDER.length : i;
};

export interface SemesterGroup<T> {
  key: string;
  label: string;
  courses: T[];
}

// Courses with a year come first in study-plan order; the rest (electives,
// specialization courses) close the list under one heading.
export function groupBySemester<T extends { course: Course }>(cards: T[]): SemesterGroup<T>[] {
  const sorted = [...cards].sort(
    (a, b) =>
      (a.course.year_level ?? 99) - (b.course.year_level ?? 99) ||
      semesterRank(a.course.semester) - semesterRank(b.course.semester) ||
      a.course.name.localeCompare(b.course.name, "he"),
  );
  const groups: SemesterGroup<T>[] = [];
  for (const card of sorted) {
    const year = yearLabel(card.course.year_level);
    const semester = semesterLabel(card.course.semester);
    const key = year ? `${card.course.year_level}|${semester ?? ""}` : "other";
    const label = !year
      ? "בחירה, התמחויות וקורסים ללא שיבוץ"
      : semester
        ? `${year} · ${semester}`
        : year;
    const last = groups.at(-1);
    if (last?.key === key) last.courses.push(card);
    else groups.push({ key, label, courses: [card] });
  }
  return groups;
}

type CourseFilters = {
  q?: string;
  departmentId?: string;
  view?: CourseView;
  sort?: CourseSort;
  page?: number;
};

export const COURSES_PAGE_SIZE = 32;
/** "מבחן בעוד N ימים" shows for a test this close. */
const EXAM_BADGE_DAYS = 14;
const MAX_PARTNERS = 4;
const DAY_MS = 86_400_000;

export function parseCoursePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/** Everything the page is shaped from — loaded from Supabase or the demo. */
export interface CoursesInputs {
  institutionId: string | null;
  courses: Course[];
  departments: Department[];
  favoriteIds: string[];
  studentCounts: Record<string, number>;
  roomCounts: Record<string, number>;
  enrollments: EnrollmentWithCourse[];
  topics: CourseTopic[];
  progress: TopicProgress[];
  events: CourseTest[];
  /** Classmates per course of mine (me excluded), at most MAX_PARTNERS. */
  partners: Record<string, { id: string; name: string; avatarPath: string | null }[]>;
}

export async function getCoursesPageData(userId: string, filters: CourseFilters) {
  const demo = await getDemoScenario();
  if (demo) return shapeCoursesPage(demoCatalog(demo), filters);
  return timed(
    "page.courses",
    loadInputs(userId).then((inputs) => shapeCoursesPage(inputs, filters)),
  );
}

async function loadInputs(userId: string): Promise<CoursesInputs> {
  const supabase = await createClient();
  const pFavoriteIds = listFavoriteCourseIds(supabase, userId);
  const pEnrollments = listMyEnrollments(supabase, userId);
  const pProgress = listMyTopicProgress(supabase, userId);
  const pMyIds = pEnrollments.then((rows) =>
    rows.filter((e) => e.status === "active").map((e) => e.course_id),
  );
  // My courses' syllabus, tests and classmates run alongside the catalog.
  const pMine = pMyIds.then(async (ids) => {
    const [topics, events, rosters] = await Promise.all([
      listCourseTopics(supabase, ids),
      listUpcomingTestsForCourses(supabase, ids),
      listCourseRosters(supabase, ids),
    ]);
    const firstIds = new Map<string, string[]>();
    for (const r of rosters) {
      if (r.user_id === userId) continue;
      const list = firstIds.get(r.course_id) ?? [];
      if (list.length < MAX_PARTNERS) firstIds.set(r.course_id, [...list, r.user_id]);
    }
    const profiles = await listPublicProfiles(supabase, [
      ...new Set([...firstIds.values()].flat()),
    ]);
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const partners: CoursesInputs["partners"] = {};
    for (const [courseId, memberIds] of firstIds) {
      partners[courseId] = memberIds.flatMap((id) => {
        const p = byId.get(id);
        return p ? [{ id: p.id, name: p.full_name, avatarPath: p.avatar_url }] : [];
      });
    }
    return { topics, events, partners };
  });

  const profile = await getCachedOwnProfile(userId);
  const institutionId = profile?.institution_id ?? null;
  const [catalog, favoriteIds, enrollments, progress, mine] = await Promise.all([
    institutionId
      ? Promise.all([
          listActiveCourses(supabase, { institutionId }),
          listDepartments(supabase, institutionId),
          getCatalogCounts(supabase, institutionId),
        ])
      : null,
    pFavoriteIds,
    pEnrollments,
    pProgress,
    pMine,
  ]);
  const [courses, departments, counts] = catalog ?? [[], [], { studentCounts: {}, roomCounts: {} }];
  return {
    institutionId,
    courses,
    departments,
    favoriteIds,
    studentCounts: counts.studentCounts,
    roomCounts: counts.roomCounts,
    enrollments,
    progress,
    ...mine,
  };
}

export type CourseCardData = ReturnType<typeof shapeCoursesPage>["myCourses"][number];

// Filtering, sorting, cards and counters — shared with demo mode.
export function shapeCoursesPage(inputs: CoursesInputs, filters: CourseFilters) {
  const now = Date.now();
  const view = filters.view ?? "all";
  const pinned = new Set(inputs.favoriteIds);
  const departmentName = new Map(inputs.departments.map((d) => [d.id, d.name]));
  const enrollmentByCourse = new Map(
    inputs.enrollments.filter((e) => e.status === "active").map((e) => [e.course_id, e]),
  );
  const topicsByCourse = new Map<string, CourseTopic[]>();
  for (const t of inputs.topics) {
    topicsByCourse.set(t.course_id, [...(topicsByCourse.get(t.course_id) ?? []), t]);
  }
  // The nearest upcoming test per course.
  const nextExam = new Map<string, number>();
  for (const e of inputs.events) {
    if (e.kind !== "test" || !e.due_at) continue;
    const at = new Date(e.due_at).getTime();
    if (at <= now) continue;
    nextExam.set(e.course_id, Math.min(nextExam.get(e.course_id) ?? Infinity, at));
  }
  const activity = (id: string) =>
    (inputs.studentCounts[id] ?? 0) + (inputs.roomCounts[id] ?? 0) * 2;

  const card = (course: Course) => {
    const enrollment = enrollmentByCourse.get(course.id) ?? null;
    let progress: { done: number; total: number; pct: number } | null = null;
    if (enrollment) {
      const summary = summarizeTopics(topicsByCourse.get(course.id) ?? [], inputs.progress);
      progress = {
        done: summary.mastered,
        total: summary.total,
        // No syllabus yet: the enrollment's own percentage.
        pct:
          summary.total > 0
            ? Math.min(100, Math.round((summary.mastered / summary.total) * 100))
            : Math.round(enrollment.progress_percent ?? 0),
      };
    }
    const allTopicsDone =
      progress !== null && progress.total > 0 && progress.done === progress.total;
    const examAt = enrollment ? nextExam.get(course.id) : undefined;
    const examInDays = examAt ? Math.max(0, Math.ceil((examAt - now) / DAY_MS)) : null;
    return {
      course,
      id: course.id,
      name: course.name,
      code: course.code,
      year: yearLabel(course.year_level),
      departmentName: course.department_id
        ? (departmentName.get(course.department_id) ?? null)
        : null,
      enrolled: enrollment !== null,
      pinned: pinned.has(course.id),
      progress,
      completed: enrollment !== null && (enrollment.completed_at !== null || allTopicsDone),
      // Marked by hand ("סימון כהושלם"), not by finishing every topic.
      canUncomplete: enrollment?.completed_at != null && !allTopicsDone,
      students: inputs.studentCounts[course.id] ?? 0,
      rooms: inputs.roomCounts[course.id] ?? 0,
      examInDays: examInDays !== null && examInDays <= EXAM_BADGE_DAYS ? examInDays : null,
      examSortKey: examAt ?? Infinity,
      partners: inputs.partners[course.id] ?? [],
    };
  };

  const q = filters.q?.trim().toLowerCase();
  const matching = inputs.courses
    .filter((c) => {
      if (filters.departmentId && c.department_id !== filters.departmentId) return false;
      if (view === "favorites" && !pinned.has(c.id)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || !!c.code?.toLowerCase().includes(q);
    })
    .map(card);

  type Card = (typeof matching)[number];
  const byName = (a: Card, b: Card) => a.name.localeCompare(b.name, "he");
  const bySort = (a: Card, b: Card): number => {
    switch (filters.sort) {
      case "az":
      case "semester":
        return byName(a, b);
      case "progress":
        return (
          (b.progress?.pct ?? -1) - (a.progress?.pct ?? -1) ||
          activity(b.id) - activity(a.id) ||
          byName(a, b)
        );
      case "students":
        return (
          (inputs.studentCounts[b.id] ?? 0) - (inputs.studentCounts[a.id] ?? 0) ||
          activity(b.id) - activity(a.id) ||
          byName(a, b)
        );
      case "rooms":
        return (
          (inputs.roomCounts[b.id] ?? 0) - (inputs.roomCounts[a.id] ?? 0) ||
          activity(b.id) - activity(a.id) ||
          byName(a, b)
        );
      default:
        return activity(b.id) - activity(a.id) || byName(a, b);
    }
  };
  // Pinned courses ("נעיצה למעלה") first, in both sections.
  const ordered = (cards: Card[]) =>
    [...cards].sort((a, b) => Number(b.pinned) - Number(a.pinned) || bySort(a, b));

  const myCourses = ordered(matching.filter((c) => c.enrolled));
  const others = view === "mine" ? [] : ordered(matching.filter((c) => !c.enrolled));

  // "כל הקורסים" is paged; within a department it can follow the study plan.
  const grouped = filters.sort === "semester" && others.some((c) => c.course.year_level !== null);
  const allGroups = grouped ? groupBySemester(others) : [];
  const pagedSource = grouped ? allGroups.flatMap((g) => g.courses) : others;
  const pageCount = Math.max(1, Math.ceil(pagedSource.length / COURSES_PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, pageCount);
  const otherCourses = pagedSource.slice((page - 1) * COURSES_PAGE_SIZE, page * COURSES_PAGE_SIZE);
  const groupSize = new Map(allGroups.map((g) => [g.key, g.courses.length]));
  const semesterGroups = grouped
    ? groupBySemester(otherCourses).map((g) => ({ ...g, total: groupSize.get(g.key) ?? 0 }))
    : null;

  const sum = (counts: Record<string, number>) =>
    Object.values(counts).reduce((s, n) => s + Number(n), 0);

  return {
    institutionId: inputs.institutionId,
    departments: inputs.departments,
    view,
    myCourses,
    otherCourses,
    semesterGroups,
    pagination: { page, pageCount, total: pagedSource.length },
    hasEnrollments: enrollmentByCourse.size > 0,
    totals: {
      courses: inputs.courses.length,
      // Enrollments across the catalog (a student in two courses counts
      // twice) — distinct users aren't visible across courses under RLS.
      students: sum(inputs.studentCounts),
      liveRooms: sum(inputs.roomCounts),
    },
  };
}
