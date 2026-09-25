import type { SupabaseClient } from "@supabase/supabase-js";

export interface Message {
  id: string;
  room_id: string;
  sender_id: string | null;
  sender_type: "user" | "ai" | "system";
  content: string;
  status: "complete" | "streaming" | "failed";
  ai_run_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  deleted_at: string | null;
}

export interface UnreadSummary {
  room_id: string;
  unread_count: number;
  last_message_at: string | null;
}

// Keyset cursor: the (created_at, id) of the oldest message already loaded,
// matching the messages_room_created_id_idx index and query order below.
export interface MessageCursor {
  createdAt: string;
  id: string;
}

// Ordered (created_at desc, id desc) — newest first, matching
// messages_room_created_id_idx. Visibility matches the messages_select_member
// RLS policy exactly: the caller must be an active room member, and a
// soft-deleted row (deleted_at set) is only ever returned when it is the
// caller's OWN message — soft-deleted rows from other senders are excluded
// entirely by RLS, not merely flagged, so no extra filtering is needed here.
export async function listRoomMessages(
  client: SupabaseClient,
  roomId: string,
  options: { before?: MessageCursor; limit?: number } = {},
): Promise<Message[]> {
  const limit = options.limit ?? 50;
  let query = client
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (options.before) {
    const { createdAt, id } = options.before;
    // Keyset predicate for (created_at, id) < (createdAt, id) under DESC order.
    query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Message[];
}

// INSERT only sender_type:'user', sender_id, content, room_id — created_at,
// ai_run_id and status are never accepted from the caller and are always left
// to their column defaults (now(), NULL, 'complete'), which is exactly what
// the messages_insert_user_in_active_room RLS policy requires.
export async function createUserMessage(
  client: SupabaseClient,
  input: { roomId: string; senderId: string; content: string },
): Promise<Message> {
  const { data, error } = await client
    .from("messages")
    .insert({
      room_id: input.roomId,
      sender_id: input.senderId,
      sender_type: "user",
      content: input.content,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

// Timestamps of the caller's own messages since a date — the analytics
// "learning activity" chart buckets these by week.
export async function listMyMessageTimestamps(
  client: SupabaseClient,
  userId: string,
  sinceIso: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("messages")
    .select("created_at")
    .eq("sender_id", userId)
    .eq("sender_type", "user")
    .gte("created_at", sinceIso)
    .order("created_at");
  if (error) throw error;
  return (data as { created_at: string }[]).map((row) => row.created_at);
}

// Wraps soft_delete_message(p_message_id): own message, within 5 minutes.
export async function softDeleteMessage(client: SupabaseClient, messageId: string): Promise<void> {
  const { error } = await client.rpc("soft_delete_message", { p_message_id: messageId });
  if (error) throw error;
}

// Wraps mark_room_read(p_room_id).
export async function markRoomRead(client: SupabaseClient, roomId: string): Promise<void> {
  const { error } = await client.rpc("mark_room_read", { p_room_id: roomId });
  if (error) throw error;
}

// Wraps get_unread_summary() — already scoped to the caller.
export async function getUnreadSummary(client: SupabaseClient): Promise<UnreadSummary[]> {
  const { data, error } = await client.rpc("get_unread_summary");
  if (error) throw error;
  return data as UnreadSummary[];
}
