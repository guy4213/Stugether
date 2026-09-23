import type { SupabaseClient } from "@supabase/supabase-js";

// A student's starred courses on the catalog page (course_favorites table,
// own-rows-only RLS — see 20260923000002_favorites_progress_tests.sql).

export async function listFavoriteCourseIds(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("course_favorites")
    .select("course_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data as { course_id: string }[]).map((row) => row.course_id);
}

export async function addFavorite(
  client: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<void> {
  const { error } = await client
    .from("course_favorites")
    .insert({ user_id: userId, course_id: courseId });
  if (error) throw error;
}

export async function removeFavorite(
  client: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<void> {
  const { error } = await client
    .from("course_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) throw error;
}
