import type { SupabaseClient } from "@supabase/supabase-js";

// "כל הפעילות האחרונה" (20261112000011_course_activity.sql): what happened in
// my courses and rooms — metadata only, never message content.

export type CourseActivityKind =
  "room_opened" | "session_scheduled" | "course_joined" | "friend_added" | "invited";

export interface CourseActivityRow {
  kind: CourseActivityKind;
  at: string;
  actor_id: string;
  actor_name: string;
  actor_avatar: string | null;
  target_id: string | null;
  target_name: string | null;
  course_id: string | null;
  course_name: string | null;
  room_id: string | null;
  room_name: string | null;
  room_is_open: boolean | null;
  room_members: number;
  i_am_member: boolean | null;
}

export async function listCourseActivity(
  client: SupabaseClient,
  options: { limit?: number; before?: string | null } = {},
): Promise<CourseActivityRow[]> {
  const { data, error } = await client.rpc("list_course_activity", {
    p_limit: options.limit ?? 30,
    p_before: options.before ?? null,
  });
  if (error) throw error;
  return (data as CourseActivityRow[]).map((r) => ({
    ...r,
    room_members: Number(r.room_members ?? 0),
  }));
}
