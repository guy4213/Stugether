import "server-only";
import { getCachedOwnProfile } from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import { getCatalogCounts, listActiveCourses, listDepartments } from "@/lib/repositories/catalog";
import { listFavoriteCourseIds } from "@/lib/repositories/favorites";
import { timed } from "@/lib/perf/timing";
import { getDemoScenario } from "@/lib/demo/state";
import { demoCatalog } from "@/lib/demo/fixtures";
import { semesterLabel, yearLabel } from "@/lib/ui/labels";
import type { Course, Department } from "@/lib/repositories/catalog";

export type CourseSort = "popular" | "rooms" | "az" | "semester";

// Within one department the default is the degree's study plan (by year and
// semester); across departments it is popularity.
export function parseCourseSort(value: string | undefined, departmentId?: string): CourseSort {
  if (value === "popular" || value === "rooms" || value === "az") return value;
  if (value === "semester") return "semester";
  return departmentId ? "semester" : "popular";
}

const SEMESTER_ORDER = ["סמסטר א׳", "סמסטר ב׳", "סמסטר קיץ"];
const semesterRank = (s: string | null) => {
  const i = SEMESTER_ORDER.indexOf(semesterLabel(s) ?? "");
  return i < 0 ? SEMESTER_ORDER.length : i;
};

export interface SemesterGroup {
  key: string;
  label: string;
  courses: Course[];
}

// Courses with a year come first in study-plan order; the rest (electives,
// specialization courses) close the list under one heading.
export function groupBySemester(courses: Course[]): SemesterGroup[] {
  const sorted = [...courses].sort(
    (a, b) =>
      (a.year_level ?? 99) - (b.year_level ?? 99) ||
      semesterRank(a.semester) - semesterRank(b.semester) ||
      a.name.localeCompare(b.name, "he"),
  );
  const groups: SemesterGroup[] = [];
  for (const course of sorted) {
    const year = yearLabel(course.year_level);
    const semester = semesterLabel(course.semester);
    const key = year ? `${course.year_level}|${semester ?? ""}` : "other";
    const label = !year
      ? "בחירה, התמחויות וקורסים ללא שיבוץ"
      : semester
        ? `${year} · ${semester}`
        : year;
    const last = groups.at(-1);
    if (last?.key === key) last.courses.push(course);
    else groups.push({ key, label, courses: [course] });
  }
  return groups;
}

type CourseFilters = { q?: string; departmentId?: string; favorites?: boolean; sort?: CourseSort };

export async function getCoursesPageData(userId: string, filters: CourseFilters) {
  const demo = await getDemoScenario();
  if (demo) return shapeCoursesPage({ ...demoCatalog(demo), filters });
  return timed("page.courses", loadCoursesPageData(userId, filters));
}

async function loadCoursesPageData(userId: string, filters: CourseFilters) {
  const supabase = await createClient();
  // Favorites run alongside the profile and the catalog reads below, which
  // wait only for the profile (cached — usually already fetched by the layout).
  const pFavoriteIds = listFavoriteCourseIds(supabase, userId);
  const profile = await getCachedOwnProfile(userId);
  const institutionId = profile?.institution_id ?? null;
  const pCatalog = institutionId
    ? Promise.all([
        listActiveCourses(supabase, { institutionId }),
        listDepartments(supabase, institutionId),
        getCatalogCounts(supabase, institutionId),
      ])
    : null;
  const favoriteIds = await pFavoriteIds;
  const empty = {
    courses: [],
    semesterGroups: null,
    departments: [],
    favoriteIds: new Set(favoriteIds),
    roomCounts: {} as Record<string, number>,
    studentCounts: {} as Record<string, number>,
    popularIds: new Set<string>(),
    totals: { courses: 0, students: 0, liveRooms: 0 },
    institutionId,
  };
  if (!pCatalog) return empty;

  // All of the institution's courses: the hero counters describe the whole
  // catalog, the grid shows the filtered subset. Counts are keyed by
  // institution, so all three run in one round trip.
  const [courses, departments, { roomCounts, studentCounts }] = await pCatalog;
  return shapeCoursesPage({
    courses,
    departments,
    favoriteIds,
    roomCounts,
    studentCounts,
    institutionId,
    filters,
  });
}

// Filtering, sorting and counters — shared with demo mode's fixed catalog.
function shapeCoursesPage({
  courses: allCourses,
  departments,
  favoriteIds,
  roomCounts,
  studentCounts,
  institutionId,
  filters,
}: {
  courses: Course[];
  departments: Department[];
  favoriteIds: string[];
  roomCounts: Record<string, number>;
  studentCounts: Record<string, number>;
  institutionId: string | null;
  filters: CourseFilters;
}) {
  const favoriteSet = new Set(favoriteIds);
  const q = filters.q?.trim().toLowerCase();
  const activity = (id: string) => (studentCounts[id] ?? 0) + (roomCounts[id] ?? 0) * 2;

  const courses = allCourses
    .filter((c) => {
      if (filters.departmentId && c.department_id !== filters.departmentId) return false;
      if (filters.favorites && !favoriteSet.has(c.id)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || !!c.code?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (filters.sort === "az" || filters.sort === "semester")
        return a.name.localeCompare(b.name, "he");
      if (filters.sort === "rooms")
        return (roomCounts[b.id] ?? 0) - (roomCounts[a.id] ?? 0) || activity(b.id) - activity(a.id);
      return activity(b.id) - activity(a.id) || a.name.localeCompare(b.name, "he");
    });

  // The two busiest courses of the institution get the "פופולרי" badge.
  const popularIds = new Set(
    [...allCourses]
      .filter((c) => activity(c.id) > 0)
      .sort((a, b) => activity(b.id) - activity(a.id))
      .slice(0, 2)
      .map((c) => c.id),
  );

  const sum = (counts: Record<string, number>) =>
    Object.values(counts).reduce((s, n) => s + Number(n), 0);

  // Grouping only helps when the catalog has a study plan to group by.
  const semesterGroups =
    filters.sort === "semester" && courses.some((c) => c.year_level !== null)
      ? groupBySemester(courses)
      : null;

  return {
    courses,
    semesterGroups,
    departments,
    favoriteIds: favoriteSet,
    roomCounts,
    studentCounts,
    popularIds,
    totals: {
      courses: allCourses.length,
      // Enrollments across the catalog (a student in two courses counts
      // twice) — distinct users aren't visible across courses under RLS.
      students: sum(studentCounts),
      liveRooms: sum(roomCounts),
    },
    institutionId,
  };
}
