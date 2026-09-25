import type { SupabaseClient } from "@supabase/supabase-js";

export type StudyMode = "online" | "campus";
export type StudyActivity = "summaries" | "exercises" | "review" | "exam_prep";
export const STUDY_DURATIONS = [30, 60, 90, 120] as const;
export type StudyDuration = (typeof STUDY_DURATIONS)[number];

export interface StudyAvailability {
  user_id: string;
  course_id: string;
  mode: StudyMode;
  duration_minutes: StudyDuration;
  activity: StudyActivity;
  topic_id: string | null;
  expires_at: string;
  created_at: string;
}

// Classmates' rows are only visible while unexpired (RLS); the caller's own
// row is always visible, so filter by expiry here too.
export async function listAvailability(
  client: SupabaseClient,
  courseIds: string[],
): Promise<StudyAvailability[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await client
    .from("study_availability")
    .select("*")
    .in("course_id", courseIds)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
  return data as StudyAvailability[];
}

export async function setAvailability(
  client: SupabaseClient,
  input: {
    userId: string;
    courseId: string;
    mode: StudyMode;
    durationMinutes: StudyDuration;
    activity: StudyActivity;
    topicId: string | null;
  },
): Promise<void> {
  // Available for the chosen duration (the policy caps it at 3 hours).
  const expiresAt = new Date(Date.now() + input.durationMinutes * 60_000).toISOString();
  const { error } = await client.from("study_availability").upsert(
    {
      user_id: input.userId,
      course_id: input.courseId,
      mode: input.mode,
      duration_minutes: input.durationMinutes,
      activity: input.activity,
      topic_id: input.topicId,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,course_id" },
  );
  if (error) throw error;
}

export async function clearAvailability(
  client: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<void> {
  const { error } = await client
    .from("study_availability")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) throw error;
}
