import type { SupabaseClient } from "@supabase/supabase-js";

export interface CourseTopic {
  id: string;
  course_id: string;
  position: number;
  title: string;
}

export type TopicStatus = "in_progress" | "mastered";

export interface TopicProgress {
  topic_id: string;
  status: TopicStatus;
  updated_at: string;
}

export async function listCourseTopics(
  client: SupabaseClient,
  courseIds: string[],
): Promise<CourseTopic[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await client
    .from("course_topics")
    .select("id, course_id, position, title")
    .in("course_id", courseIds)
    .eq("is_active", true)
    .order("position");
  if (error) throw error;
  return data as CourseTopic[];
}

// RLS (topic_progress_select_own) already limits rows to the caller.
export async function listMyTopicProgress(
  client: SupabaseClient,
  userId: string,
): Promise<TopicProgress[]> {
  const { data, error } = await client
    .from("topic_progress")
    .select("topic_id, status, updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  return data as TopicProgress[];
}

// null clears the topic back to "not started". The DB trigger
// recompute_enrollment_progress keeps enrollments.progress_percent in sync.
export async function setTopicStatus(
  client: SupabaseClient,
  userId: string,
  topicId: string,
  status: TopicStatus | null,
): Promise<void> {
  if (status === null) {
    const { error } = await client
      .from("topic_progress")
      .delete()
      .eq("user_id", userId)
      .eq("topic_id", topicId);
    if (error) throw error;
    return;
  }
  const { error } = await client
    .from("topic_progress")
    .upsert(
      { user_id: userId, topic_id: topicId, status, updated_at: new Date().toISOString() },
      { onConflict: "user_id,topic_id" },
    );
  if (error) throw error;
}
