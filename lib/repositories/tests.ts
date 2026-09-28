import type { SupabaseClient } from "@supabase/supabase-js";

export type EventKind = "test" | "workshop" | "study_session";

// A course event: a test, a workshop or a group study session (tests.kind).
export interface CourseTest {
  id: string;
  kind: EventKind;
  location: string | null;
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

// Dashboard's events, for the courses the caller is actively enrolled in —
// the caller passes those ids (it already has them), which saves a round
// trip. RLS (tests_select_enrolled_or_admin) limits the rows the same way.
export async function listUpcomingTestsForCourses(
  client: SupabaseClient,
  courseIds: string[],
): Promise<CourseTestWithCourse[]> {
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
    kind?: EventKind;
    location?: string | null;
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
      kind: input.kind ?? "test",
      location: input.location ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CourseTest;
}

// event_registrations rows are visible to everyone enrolled in the event's
// course (RLS), so counts and "who is coming" avatars are plain reads.
export async function listEventRegistrations(
  client: SupabaseClient,
  eventIds: string[],
): Promise<{ event_id: string; user_id: string }[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await client
    .from("event_registrations")
    .select("event_id, user_id")
    .in("event_id", eventIds)
    .order("created_at");
  if (error) throw error;
  return data as { event_id: string; user_id: string }[];
}

export async function setEventRegistration(
  client: SupabaseClient,
  userId: string,
  eventId: string,
  registered: boolean,
): Promise<void> {
  if (registered) {
    const { error } = await client
      .from("event_registrations")
      .upsert({ event_id: eventId, user_id: userId }, { onConflict: "event_id,user_id" });
    if (error) throw error;
    return;
  }
  const { error } = await client
    .from("event_registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw error;
}
