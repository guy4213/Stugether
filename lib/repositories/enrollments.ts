import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course } from "./catalog";

// Design decision: unenroll() performs a HARD DELETE of the enrollments row
// (enrollments_delete_own RLS policy permits it), rather than setting
// status='archived'. Rationale: accept_room_invitation / can_invite_to_room /
// set_room_status etc. all check for a live ('active') enrollment row at the
// moment they run, not enrollment history, so a hard delete is functionally
// safe. Keeping "archived" as a status is still used elsewhere (e.g. a user
// could in principle be given an archived row by an admin process), but this
// repository's own unenroll always removes the row outright. Be consistent:
// do not also add a soft-archive unenroll path elsewhere without revisiting
// this decision.

export interface EnrollmentWithCourse {
  id: string;
  user_id: string;
  course_id: string;
  status: "active" | "archived";
  progress_percent: number;
  completed_at: string | null;
  created_at: string;
  course: Course;
}

export async function listMyEnrollments(
  client: SupabaseClient,
  userId: string,
): Promise<EnrollmentWithCourse[]> {
  const { data, error } = await client
    .from("enrollments")
    .select("*, course:courses(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as EnrollmentWithCourse[];
}

export async function enroll(
  client: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<EnrollmentWithCourse> {
  const { data, error } = await client
    .from("enrollments")
    .insert({ user_id: userId, course_id: courseId })
    .select("*, course:courses(*)")
    .single();
  if (error) throw error;
  return data as unknown as EnrollmentWithCourse;
}

// Hard delete — see the module-level comment above for why.
export async function unenroll(
  client: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<void> {
  const { error } = await client
    .from("enrollments")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) throw error;
}

// Catalog "N students" per course. Wraps count_active_students_by_course()
// (aggregate only) because RLS hides rosters of courses the caller isn't in.
export async function countActiveStudentsByCourseIds(
  client: SupabaseClient,
  courseIds: string[],
): Promise<Record<string, number>> {
  if (courseIds.length === 0) return {};
  const { data, error } = await client.rpc("count_active_students_by_course", {
    p_course_ids: courseIds,
  });
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data as { course_id: string; student_count: number }[]) {
    counts[row.course_id] = Number(row.student_count);
  }
  return counts;
}

// For the analytics page: per-course progress bars + "completed courses"
// count (replacing "certificates" in the mockup).
export async function updateProgress(
  client: SupabaseClient,
  userId: string,
  courseId: string,
  input: { progressPercent: number; completedAt?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { progress_percent: input.progressPercent };
  if (input.completedAt !== undefined) patch.completed_at = input.completedAt;

  const { error } = await client
    .from("enrollments")
    .update(patch)
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) throw error;
}

// Active rosters of the given courses. RLS returns rows only for courses the
// caller is actively enrolled in (enrollments_select_own_admin_or_same_course).
export async function listCourseRosters(
  client: SupabaseClient,
  courseIds: string[],
): Promise<{ course_id: string; user_id: string }[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await client
    .from("enrollments")
    .select("course_id, user_id")
    .in("course_id", courseIds)
    .eq("status", "active")
    .order("created_at");
  if (error) throw error;
  return data as { course_id: string; user_id: string }[];
}

// Distinct classmates across the caller's actively-enrolled courses (the
// dashboard's "Active Students" stat). enrollments_select_own_admin_or_same_course
// RLS already scopes visible rows to courses the caller is themselves active
// in, so this is a plain query + client-side dedupe, no admin client needed.
export async function countActiveClassmates(
  client: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data: mine, error: mineError } = await client
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .eq("status", "active");
  if (mineError) throw mineError;

  const courseIds = (mine as { course_id: string }[]).map((row) => row.course_id);
  if (courseIds.length === 0) return 0;

  const { data, error } = await client
    .from("enrollments")
    .select("user_id")
    .in("course_id", courseIds)
    .eq("status", "active")
    .neq("user_id", userId);
  if (error) throw error;

  return new Set((data as { user_id: string }[]).map((row) => row.user_id)).size;
}
