import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listActiveCourses, listDepartments } from "@/lib/repositories/catalog";
import { listFavoriteCourseIds } from "@/lib/repositories/favorites";
import { countActiveRoomsByCourseIds } from "@/lib/repositories/rooms";
import { countActiveStudentsByCourseIds } from "@/lib/repositories/enrollments";

export type CourseSort = "popular" | "rooms" | "az";

export function parseCourseSort(value: string | undefined): CourseSort {
  return value === "rooms" || value === "az" ? value : "popular";
}

export async function getCoursesPageData(
  userId: string,
  filters: { q?: string; departmentId?: string; favorites?: boolean; sort?: CourseSort },
) {
  const supabase = await createClient();
  const [profile, favoriteIds] = await Promise.all([
    getOwnProfile(supabase, userId),
    listFavoriteCourseIds(supabase, userId),
  ]);
  const institutionId = profile?.institution_id ?? null;
  const empty = {
    courses: [],
    departments: [],
    favoriteIds: new Set(favoriteIds),
    roomCounts: {} as Record<string, number>,
    studentCounts: {} as Record<string, number>,
    popularIds: new Set<string>(),
    totals: { courses: 0, students: 0, liveRooms: 0 },
    institutionId,
  };
  if (!institutionId) return empty;

  // All of the institution's courses: the hero counters describe the whole
  // catalog, the grid shows the filtered subset.
  const [allCourses, departments] = await Promise.all([
    listActiveCourses(supabase, { institutionId }),
    listDepartments(supabase, institutionId),
  ]);
  const allIds = allCourses.map((c) => c.id);
  const [roomCounts, studentCounts] = await Promise.all([
    countActiveRoomsByCourseIds(supabase, allIds),
    countActiveStudentsByCourseIds(supabase, allIds),
  ]);

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
      if (filters.sort === "az") return a.name.localeCompare(b.name, "he");
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

  return {
    courses,
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
