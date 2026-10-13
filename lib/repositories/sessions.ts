import type { SupabaseClient } from "@supabase/supabase-js";

// Planned study sessions of a room (20261013000006_room_sessions.sql).
// Members read through RLS; every write is an RPC.

export type SessionStatus = "proposed" | "scheduled" | "cancelled";

export interface RoomSessionRow {
  id: string;
  room_id: string;
  proposed_by: string;
  status: SessionStatus;
  starts_at: string | null;
  duration_min: number;
  note: string | null;
  created_at: string;
  options: { id: string; starts_at: string; votes: { user_id: string }[] }[];
  rsvps: { user_id: string; response: "accepted" | "declined" }[];
}

const SESSION_SELECT =
  "id, room_id, proposed_by, status, starts_at, duration_min, note, created_at, " +
  "options:room_session_options(id, starts_at, votes:room_session_votes(user_id)), " +
  "rsvps:room_session_rsvps(user_id, response)";

// The room's sessions that are not cancelled, newest first.
export async function listRoomSessions(
  client: SupabaseClient,
  roomId: string,
): Promise<RoomSessionRow[]> {
  const { data, error } = await client
    .from("room_sessions")
    .select(SESSION_SELECT)
    .eq("room_id", roomId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data as unknown as RoomSessionRow[];
}

// Next scheduled session per room (dashboard "חדרי לימוד").
export async function listUpcomingSessions(
  client: SupabaseClient,
  roomIds: string[],
): Promise<{ id: string; room_id: string; starts_at: string }[]> {
  if (roomIds.length === 0) return [];
  const { data, error } = await client
    .from("room_sessions")
    .select("id, room_id, starts_at")
    .in("room_id", roomIds)
    .eq("status", "scheduled")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;
  return data as { id: string; room_id: string; starts_at: string }[];
}

export async function getRoomSession(
  client: SupabaseClient,
  sessionId: string,
): Promise<RoomSessionRow | null> {
  const { data, error } = await client
    .from("room_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as RoomSessionRow | null;
}

export async function proposeRoomSession(
  client: SupabaseClient,
  input: { roomId: string; options: string[]; durationMin: number; note: string | null },
): Promise<string> {
  const { data, error } = await client.rpc("propose_room_session", {
    p_room_id: input.roomId,
    p_options: input.options,
    p_duration_min: input.durationMin,
    p_note: input.note,
  });
  if (error) throw error;
  return data as string;
}

export async function voteRoomSession(client: SupabaseClient, optionId: string, vote: boolean) {
  const { error } = await client.rpc("vote_room_session", { p_option_id: optionId, p_vote: vote });
  if (error) throw error;
}

export async function scheduleRoomSession(client: SupabaseClient, optionId: string) {
  const { error } = await client.rpc("schedule_room_session", { p_option_id: optionId });
  if (error) throw error;
}

export async function rsvpRoomSession(
  client: SupabaseClient,
  sessionId: string,
  response: "accepted" | "declined",
) {
  const { error } = await client.rpc("rsvp_room_session", {
    p_session_id: sessionId,
    p_response: response,
  });
  if (error) throw error;
}

export async function cancelRoomSession(client: SupabaseClient, sessionId: string) {
  const { error } = await client.rpc("cancel_room_session", { p_session_id: sessionId });
  if (error) throw error;
}
