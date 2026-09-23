import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course } from "./catalog";
import type { Profile } from "./profiles";

export interface GlobalStats {
  users_total: number;
  users_active_7d: number;
  rooms_total: number;
  rooms_active: number;
  messages_total: number;
  ai_runs_total: number;
  ai_runs_failed: number;
}

export interface RoomStats {
  room_id: string;
  member_count: number;
  message_count: number;
  last_message_at: string | null;
}

export interface AdminRoomListItem {
  id: string;
  name: string;
  status: "active" | "archived" | "closed";
  course: Pick<Course, "id" | "name" | "code"> | null;
  member_count: number;
  message_count: number;
  last_message_at: string | null;
}

// Wraps admin_global_stats(): super_admin only, raises NOT_ALLOWED otherwise.
export async function getGlobalStats(client: SupabaseClient): Promise<GlobalStats> {
  const { data, error } = await client.rpc("admin_global_stats");
  if (error) throw error;
  return data as GlobalStats;
}

// Wraps admin_room_stats(): super_admin only, never exposes message content.
export async function getRoomStats(client: SupabaseClient): Promise<RoomStats[]> {
  const { data, error } = await client.rpc("admin_room_stats");
  if (error) throw error;
  return data as RoomStats[];
}

// Full profile rows across all users. RLS (profiles_select_own_or_admin)
// already restricts this to an active super_admin session — call with the
// user-scoped client, not the admin client, so an ordinary user's call
// legitimately gets nothing beyond their own row instead of everything.
export async function listAllUsers(
  client: SupabaseClient,
  filters: { search?: string; institutionId?: string; departmentId?: string } = {},
): Promise<Profile[]> {
  let query = client.from("profiles").select("*");
  if (filters.search) query = query.ilike("full_name", `%${filters.search}%`);
  if (filters.institutionId) query = query.eq("institution_id", filters.institutionId);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);

  const { data, error } = await query.order("full_name");
  if (error) throw error;
  return data as Profile[];
}

// Activate/deactivate a user. RLS (profiles_update_super_admin) plus the
// guard_profile_privileged_columns trigger already require the caller to be
// an active super_admin to touch is_active — call with the user-scoped client.
export async function setUserActive(
  client: SupabaseClient,
  userId: string,
  isActive: boolean,
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

// Room list for the admin panel: metadata + course + member/message counts
// only — never message content. Combines a rooms+courses query with the
// admin_room_stats() RPC (the only path to counts, since messages has no
// super_admin SELECT policy) and merges them in JS.
export async function listAllRooms(
  client: SupabaseClient,
  filters: { search?: string; status?: "active" | "archived" | "closed" } = {},
): Promise<AdminRoomListItem[]> {
  let query = client
    .from("rooms")
    .select("id, name, status, course:courses(id, name, code)");
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters.status) query = query.eq("status", filters.status);

  const [{ data: rooms, error: roomsError }, stats] = await Promise.all([
    query.order("name"),
    getRoomStats(client),
  ]);
  if (roomsError) throw roomsError;

  const statsByRoom = new Map(stats.map((s) => [s.room_id, s]));

  return (
    rooms as unknown as {
      id: string;
      name: string;
      status: "active" | "archived" | "closed";
      course: Pick<Course, "id" | "name" | "code"> | null;
    }[]
  ).map((room) => {
    const s = statsByRoom.get(room.id);
    return {
      id: room.id,
      name: room.name,
      status: room.status,
      course: room.course,
      member_count: s?.member_count ?? 0,
      message_count: s?.message_count ?? 0,
      last_message_at: s?.last_message_at ?? null,
    };
  });
}
