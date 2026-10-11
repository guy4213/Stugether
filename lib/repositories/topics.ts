import type { SupabaseClient } from "@supabase/supabase-js";

export type TopicSource =
  "manual" | "official_syllabus" | "official_description" | "equivalent_course" | "ai_draft";

export interface Subtopic {
  id: string;
  position: number;
  title: string;
}

// A top-level syllabus topic. Progress and room links attach to these;
// subtopics only add detail.
export interface CourseTopic {
  id: string;
  course_id: string;
  position: number;
  title: string;
  source: TopicSource;
  status: "draft" | "verified";
  source_ref: string | null;
  source_url: string | null;
  subtopics: Subtopic[];
}

export type TopicStatus = "in_progress" | "mastered";

export interface TopicProgress {
  topic_id: string;
  status: TopicStatus;
  updated_at: string;
}

type TopicRow = Omit<CourseTopic, "subtopics"> & { parent_id: string | null };

export async function listCourseTopics(
  client: SupabaseClient,
  courseIds: string[],
): Promise<CourseTopic[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await client
    .from("course_topics")
    .select("id, course_id, parent_id, position, title, source, status, source_ref, source_url")
    .in("course_id", courseIds)
    .eq("is_active", true)
    .order("position");
  if (error) throw error;

  const rows = data as TopicRow[];
  const subtopicsByParent = new Map<string, Subtopic[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = subtopicsByParent.get(row.parent_id) ?? [];
    list.push({ id: row.id, position: row.position, title: row.title });
    subtopicsByParent.set(row.parent_id, list);
  }
  return rows
    .filter((row) => row.parent_id === null)
    .map((row) => ({
      id: row.id,
      course_id: row.course_id,
      position: row.position,
      title: row.title,
      source: row.source,
      status: row.status,
      source_ref: row.source_ref,
      source_url: row.source_url,
      subtopics: subtopicsByParent.get(row.id) ?? [],
    }));
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

// Replaces the room's linked topics (owner only; set_room_topics RPC, which
// also refreshes rooms.topic for the AI prompt).
export async function setRoomTopics(
  client: SupabaseClient,
  roomId: string,
  topicIds: string[],
): Promise<void> {
  const { error } = await client.rpc("set_room_topics", {
    p_room_id: roomId,
    p_topic_ids: topicIds,
  });
  if (error) throw error;
}
