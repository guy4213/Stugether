import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listActiveCourses, listDepartments } from "@/lib/repositories/catalog";
import { listFavoriteCourseIds } from "@/lib/repositories/favorites";
import { countActiveRoomsByCourseIds } from "@/lib/repositories/rooms";
import { countActiveStudentsByCourseIds } from "@/lib/repositories/enrollments";

export async function getCoursesPageData(
  userId: string,
  filters: { q?: string; departmentId?: string; favorites?: boolean },
) {
  const supabase = await createClient();
  const [profile, favoriteIds] = await Promise.all([
    getOwnProfile(supabase, userId),
    listFavoriteCourseIds(supabase, userId),
  ]);
  const institutionId = profile?.institution_id ?? null;
  if (!institutionId) {
    return {
      courses: [],
      departments: [],
      favoriteIds: new Set(favoriteIds),
      roomCounts: {} as Record<string, number>,
      studentCounts: {} as Record<string, number>,
      institutionId,
    };
  }

  const [allCourses, departments] = await Promise.all([
    listActiveCourses(supabase, { institutionId, departmentId: filters.departmentId }),
    listDepartments(supabase, institutionId),
  ]);

  const favoriteSet = new Set(favoriteIds);
  const q = filters.q?.trim().toLowerCase();
  const courses = allCourses.filter((c) => {
    if (filters.favorites && !favoriteSet.has(c.id)) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || !!c.code?.toLowerCase().includes(q);
  });

  const courseIds = courses.map((c) => c.id);
  const [roomCounts, studentCounts] = await Promise.all([
    countActiveRoomsByCourseIds(supabase, courseIds),
    countActiveStudentsByCourseIds(supabase, courseIds),
  ]);

  return {
    courses,
    departments,
    favoriteIds: favoriteSet,
    roomCounts,
    studentCounts,
    institutionId,
  };
}
