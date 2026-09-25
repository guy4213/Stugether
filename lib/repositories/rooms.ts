import type { SupabaseClient } from "@supabase/supabase-js";
import { listPublicProfiles, type PublicProfile } from "./profiles";

export interface Room {
  id: string;
  course_id: string;
  created_by: string;
  name: string;
  topic: string | null;
  status: "active" | "archived" | "closed";
  ai_enabled: boolean;
  last_message_at: string | null;
  created_at: string;
  archived_at: string | null;
  archived_by: string | null;
  archived_by_admin: boolean;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  left_at: string | null;
  last_read_at: string | null;
  profile: PublicProfile | null;
}

export async function getRoom(client: SupabaseClient, roomId: string): Promise<Room | null> {
  const { data, error } = await client.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (error) throw error;
  return data as Room | null;
}

// Rooms the caller is an ACTIVE member of (left_at IS NULL), most recently
// active first (rooms with no messages yet sort last).
export async function listMyActiveRooms(client: SupabaseClient, userId: string): Promise<Room[]> {
  const { data, error } = await client
    .from("room_members")
    .select("room:rooms(*)")
    .eq("user_id", userId)
    .is("left_at", null)
    .order("last_message_at", { foreignTable: "rooms", ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as unknown as { room: Room }[]).map((row) => row.room);
}

// Active room counts per course, for the catalog page's "N active rooms"
// badge. rooms_select_member_or_admin RLS hides rooms from non-members, so a
// plain SELECT on "rooms" would undercount for a browsing (not-yet-joined)
// student — this wraps count_active_rooms_by_course(), which exposes only
// the aggregate (see 20260923000002_favorites_progress_tests.sql).
export async function countActiveRoomsByCourseIds(
  client: SupabaseClient,
  courseIds: string[],
): Promise<Record<string, number>> {
  if (courseIds.length === 0) return {};
  const { data, error } = await client.rpc("count_active_rooms_by_course", {
    p_course_ids: courseIds,
  });
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data as { course_id: string; room_count: number }[]) {
    counts[row.course_id] = row.room_count;
  }
  return counts;
}

// INSERT into rooms only — a DB trigger (handle_new_room) auto-adds the
// creator as the 'owner' room_members row; do not insert that row here.
export async function createRoom(
  client: SupabaseClient,
  input: { courseId: string; name: string; topic?: string | null; createdBy: string },
): Promise<Room> {
  const { data, error } = await client
    .from("rooms")
    .insert({
      course_id: input.courseId,
      name: input.name,
      topic: input.topic ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Room;
}

// Member profile info comes from the public_profiles VIEW, not "profiles":
// the caller can see full "profiles" rows only for themself (or if admin),
// but every active room member is visible via public_profiles (shares_room_with).
// public_profiles has no FK to room_members for PostgREST to auto-embed, so
// this is two queries: room_members, then a batched public_profiles lookup.
export async function listRoomMembers(
  client: SupabaseClient,
  roomId: string,
): Promise<RoomMember[]> {
  const { data, error } = await client
    .from("room_members")
    .select("room_id, user_id, role, joined_at, left_at, last_read_at")
    .eq("room_id", roomId)
    .order("joined_at");
  if (error) throw error;

  const members = data as Omit<RoomMember, "profile">[];
  if (members.length === 0) return [];

  const profiles = await listPublicProfiles(
    client,
    members.map((m) => m.user_id),
  );
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return members.map((m) => ({ ...m, profile: profileById.get(m.user_id) ?? null }));
}

// Wraps update_room(p_room_id, p_name, p_topic, p_ai_enabled): owner of an
// active room, or super_admin. Omitted fields leave that column unchanged;
// an empty-after-trim topic clears it. Undefined fields are passed as NULL.
export async function updateRoom(
  client: SupabaseClient,
  roomId: string,
  input: { name?: string; topic?: string | null; aiEnabled?: boolean },
): Promise<void> {
  const { error } = await client.rpc("update_room", {
    p_room_id: roomId,
    p_name: input.name ?? null,
    p_topic: input.topic ?? null,
    p_ai_enabled: input.aiEnabled ?? null,
  });
  if (error) throw error;
}

// Wraps set_room_status(p_room_id, p_status): owner or super_admin.
export async function setRoomStatus(
  client: SupabaseClient,
  roomId: string,
  status: "active" | "archived" | "closed",
): Promise<void> {
  const { error } = await client.rpc("set_room_status", {
    p_room_id: roomId,
    p_status: status,
  });
  if (error) throw error;
}

// Wraps leave_room(p_room_id).
export async function leaveRoom(client: SupabaseClient, roomId: string): Promise<void> {
  const { error } = await client.rpc("leave_room", { p_room_id: roomId });
  if (error) throw error;
}

// Wraps remove_room_member(p_room_id, p_user_id): owner only.
export async function removeMember(
  client: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<void> {
  const { error } = await client.rpc("remove_room_member", {
    p_room_id: roomId,
    p_user_id: userId,
  });
  if (error) throw error;
}
