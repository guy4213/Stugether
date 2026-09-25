import type { SupabaseClient } from "@supabase/supabase-js";

export interface CourseTest {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
}

export interface CourseTestWithCourse extends CourseTest {
  course: { name: string; code: string | null };
}

// Dashboard's "dynamic tests" section — DB-driven items in place of the
// static "Assignments" mock, scoped to courses the caller is actively
// enrolled in (RLS: tests_select_enrolled_or_admin already limits rows the
// same way, this ordering/shape is just for the dashboard's own query).
export async function listUpcomingTestsForUser(
  client: SupabaseClient,
  userId: string,
): Promise<CourseTestWithCourse[]> {
  const { data: enrollments, error: enrollmentsError } = await client
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .eq("status", "active");
  if (enrollmentsError) throw enrollmentsError;

  const courseIds = (enrollments as { course_id: string }[]).map((row) => row.course_id);
  if (courseIds.length === 0) return [];

  const { data, error } = await client
    .from("tests")
    .select("*, course:courses(name, code)")
    .in("course_id", courseIds)
    .eq("is_active", true)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as unknown as CourseTestWithCourse[];
}

export async function listTestsForCourse(
  client: SupabaseClient,
  courseId: string,
): Promise<CourseTest[]> {
  const { data, error } = await client
    .from("tests")
    .select("*")
    .eq("course_id", courseId)
    .eq("is_active", true)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as CourseTest[];
}

export async function createTest(
  client: SupabaseClient,
  input: {
    courseId: string;
    title: string;
    description?: string | null;
    dueAt?: string | null;
    createdBy: string;
  },
): Promise<CourseTest> {
  const { data, error } = await client
    .from("tests")
    .insert({
      course_id: input.courseId,
      title: input.title,
      description: input.description ?? null,
      due_at: input.dueAt ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CourseTest;
}
