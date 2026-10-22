import type { SupabaseClient } from "@supabase/supabase-js";

// Joining a room that is in session needs the creator's approval
// (20261013000004_room_join_requests.sql). All writes are RPCs.

export type JoinOutcome = "joined" | "requested";

export interface JoinRequest {
  id: string;
  room_id: string;
  user_id: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  created_at: string;
}

// Wraps request_room_join: joins a quiet open room directly, or files a
// request for the creator when the room is live.
export async function requestRoomJoin(
  client: SupabaseClient,
  roomId: string,
): Promise<JoinOutcome> {
  const { data, error } = await client.rpc("request_room_join", { p_room_id: roomId });
  if (error) throw error;
  return data as JoinOutcome;
}

export async function cancelRoomJoinRequest(client: SupabaseClient, roomId: string): Promise<void> {
  const { error } = await client.rpc("cancel_room_join_request", { p_room_id: roomId });
  if (error) throw error;
}

// The room's current owner only. 'unavailable': the requester is no longer
// an active student enrolled in the course; the request is cancelled.
export async function decideRoomJoinRequest(
  client: SupabaseClient,
  requestId: string,
  approve: boolean,
): Promise<"approved" | "declined" | "unavailable"> {
  const { data, error } = await client.rpc("decide_room_join_request", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw error;
  return data as "approved" | "declined" | "unavailable";
}

// RLS shows the caller their own requests and requests to rooms they own.
export async function listPendingJoinRequests(
  client: SupabaseClient,
  filter: { roomId?: string; userId?: string },
): Promise<JoinRequest[]> {
  let query = client
    .from("room_join_requests")
    .select("id, room_id, user_id, status, created_at")
    .eq("status", "pending")
    .order("created_at");
  if (filter.roomId) query = query.eq("room_id", filter.roomId);
  if (filter.userId) query = query.eq("user_id", filter.userId);
  const { data, error } = await query;
  if (error) throw error;
  return data as JoinRequest[];
}
