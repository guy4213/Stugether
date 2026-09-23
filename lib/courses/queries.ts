import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listActiveCourses, listDepartments } from "@/lib/repositories/catalog";
import { listFavoriteCourseIds } from "@/lib/repositories/favorites";
import { countActiveRoomsByCourseIds } from "@/lib/repositories/rooms";

export async function getCoursesPageData(
  userId: string,
  filters: { q?: string; departmentId?: string },
) {
  const supabase = await createClient();
  const profile = await getOwnProfile(supabase, userId);
  const institutionId = profile?.institution_id ?? null;

  const [allCourses, departments, favoriteIds] = await Promise.all([
    institutionId
      ? listActiveCourses(supabase, { institutionId, departmentId: filters.departmentId })
      : Promise.resolve([]),
    institutionId ? listDepartments(supabase, institutionId) : Promise.resolve([]),
    listFavoriteCourseIds(supabase, userId),
  ]);

  const q = filters.q?.trim().toLowerCase();
  const courses = q
    ? allCourses.filter(
        (c) => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q),
      )
    : allCourses;

  const roomCounts = await countActiveRoomsByCourseIds(
    supabase,
    courses.map((c) => c.id),
  );

  return { courses, departments, favoriteIds: new Set(favoriteIds), roomCounts, institutionId };
}
