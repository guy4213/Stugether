import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course, Department, Faculty, Institution } from "./catalog";
import type { Profile } from "./profiles";

export interface AppSettings {
  ai_system_prompt: string;
  ai_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface AiUsageSummary {
  runs: number;
  succeeded: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
}

export interface AiFailure {
  id: string;
  room_id: string;
  room_name: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

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
  status: "active" | "closed";
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

export interface UsageDay {
  day: string;
  signups: number;
  active_users: number;
  room_messages: number;
  direct_messages: number;
  rooms_created: number;
  ai_runs: number;
  ai_failed: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface UsageCourse {
  id: string;
  name: string;
  code: string | null;
  rooms_created: number;
  active_rooms: number;
  messages: number;
  ai_runs: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface UsageUser {
  id: string;
  full_name: string;
  room_messages: number;
  direct_messages: number;
  ai_runs: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface UsageAiUser {
  id: string;
  full_name: string;
  ai_runs: number;
  ai_failed: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface UsageStats {
  days: number;
  since: string;
  daily: UsageDay[];
  active_users: number;
  top_courses: UsageCourse[];
  top_users: UsageUser[];
  top_ai_users: UsageAiUser[];
}

// Wraps admin_usage_stats(p_days): super_admin only (NOT_ALLOWED otherwise).
// Counts, ids and names only — never message or DM content.
export async function getUsageStats(client: SupabaseClient, days: number): Promise<UsageStats> {
  const { data, error } = await client.rpc("admin_usage_stats", { p_days: days });
  if (error) throw error;
  return data as UsageStats;
}

export interface UsageHeatCell {
  dow: number; // 0 = Sunday
  hour: number; // 0-23, Asia/Jerusalem
  n: number;
}

// Wraps admin_usage_heatmap(p_days): actions per weekday x hour (non-empty
// cells only). super_admin only; counts only.
export async function getUsageHeatmap(
  client: SupabaseClient,
  days: number,
): Promise<UsageHeatCell[]> {
  const { data, error } = await client.rpc("admin_usage_heatmap", { p_days: days });
  if (error) throw error;
  return data as UsageHeatCell[];
}

export interface AdminUserDetails {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  study_year: number | null;
  role: "student" | "super_admin";
  is_active: boolean;
  onboarded_at: string | null;
  created_at: string;
  last_seen_at: string | null;
  institution: string | null;
  department: string | null;
  email: string | null;
  provider: string | null;
  last_sign_in_at: string | null;
  stats: {
    room_messages: number;
    direct_messages: number;
    ai_runs: number;
    ai_failed: number;
    prompt_tokens: number;
    completion_tokens: number;
    rooms_created: number;
    friends: number;
    last_activity_at: string | null;
  };
  courses: {
    id: string;
    name: string;
    code: string | null;
    status: "active" | "archived";
    enrolled_at: string;
  }[];
  rooms: {
    id: string;
    name: string;
    status: string;
    course: string;
    role: "owner" | "member";
    joined_at: string;
    left_at: string | null;
  }[];
}

// Wraps admin_user_details(p_user_id): one user's metadata, email (auth.users)
// and all-time activity counts. super_admin only; null for an unknown user.
// Never message content, never who the user talks to privately.
export async function getUserDetails(
  client: SupabaseClient,
  userId: string,
): Promise<AdminUserDetails | null> {
  const { data, error } = await client.rpc("admin_user_details", { p_user_id: userId });
  if (error) throw error;
  return (data as AdminUserDetails | null) ?? null;
}

// Full profile rows across all users. RLS (profiles_select_own_or_admin)
// already restricts this to an active super_admin session — call with the
// user-scoped client, not the admin client, so an ordinary user's call
// legitimately gets nothing beyond their own row instead of everything.
export async function listAllUsers(
  client: SupabaseClient,
  filters: {
    search?: string;
    institutionId?: string;
    departmentId?: string;
    role?: Profile["role"];
  } = {},
): Promise<Profile[]> {
  let query = client.from("profiles").select("*");
  if (filters.search) query = query.ilike("full_name", `%${filters.search}%`);
  if (filters.institutionId) query = query.eq("institution_id", filters.institutionId);
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.role) query = query.eq("role", filters.role);

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

// Grant / revoke Super Admin. Same gate as setUserActive: RLS
// (profiles_update_super_admin) plus guard_profile_privileged_columns only let
// an active super_admin change role — call with the user-scoped client.
export async function setUserRole(
  client: SupabaseClient,
  userId: string,
  role: Profile["role"],
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

// app_settings is a single row (id = 1). SELECT is open to authenticated users
// (the app needs to know whether AI is on); UPDATE is super_admin only (RLS).
export async function getAppSettings(client: SupabaseClient): Promise<AppSettings | null> {
  const { data, error } = await client
    .from("app_settings")
    .select("ai_system_prompt, ai_enabled, updated_at, updated_by")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data as AppSettings | null;
}

export async function updateAppSettings(
  client: SupabaseClient,
  userId: string,
  input: { systemPrompt?: string; aiEnabled?: boolean },
): Promise<void> {
  const patch: Record<string, unknown> = { updated_by: userId };
  if (input.systemPrompt !== undefined) patch.ai_system_prompt = input.systemPrompt;
  if (input.aiEnabled !== undefined) patch.ai_enabled = input.aiEnabled;
  const { error } = await client
    .from("app_settings")
    .update(patch)
    .eq("id", 1)
    .select("id")
    .single();
  if (error) throw error;
}

// AI consumption since a date: runs, outcomes and tokens (TECHNICAL_SPEC §6.9 —
// the real number is measured, not estimated). ai_runs SELECT includes every
// row for an active super_admin; the columns read here carry no message text.
export async function getAiUsageSummary(
  client: SupabaseClient,
  sinceIso: string,
): Promise<AiUsageSummary> {
  const { data, error } = await client
    .from("ai_runs")
    .select("status, prompt_tokens, completion_tokens")
    .gte("created_at", sinceIso);
  if (error) throw error;

  const rows = data as {
    status: string;
    prompt_tokens: number | null;
    completion_tokens: number | null;
  }[];
  return rows.reduce<AiUsageSummary>(
    (sum, r) => ({
      runs: sum.runs + 1,
      succeeded: sum.succeeded + (r.status === "succeeded" ? 1 : 0),
      failed: sum.failed + (r.status === "failed" ? 1 : 0),
      promptTokens: sum.promptTokens + (r.prompt_tokens ?? 0),
      completionTokens: sum.completionTokens + (r.completion_tokens ?? 0),
    }),
    { runs: 0, succeeded: 0, failed: 0, promptTokens: 0, completionTokens: 0 },
  );
}

// Latest failed runs, with the room name for context — error code/message
// only, never the prompt or the answer.
export async function listRecentAiFailures(
  client: SupabaseClient,
  limit = 10,
): Promise<AiFailure[]> {
  const { data, error } = await client
    .from("ai_runs")
    .select("id, room_id, error_code, error_message, created_at, room:rooms(name)")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (
    data as unknown as (Omit<AiFailure, "room_name"> & { room: { name: string } | null })[]
  ).map(({ room, ...rest }) => ({ ...rest, room_name: room?.name ?? null }));
}

// The whole catalog, INCLUDING inactive rows — catalog SELECT policies return
// inactive rows to an active super_admin only.
export async function listFullCatalog(client: SupabaseClient): Promise<{
  institutions: Institution[];
  faculties: Faculty[];
  departments: Department[];
  courses: Course[];
}> {
  const [institutions, faculties, departments, courses] = await Promise.all([
    client.from("institutions").select("*").order("name"),
    client.from("faculties").select("*").order("name"),
    client.from("departments").select("*").order("name"),
    client.from("courses").select("*").order("name"),
  ]);
  for (const r of [institutions, faculties, departments, courses]) if (r.error) throw r.error;
  return {
    institutions: institutions.data as Institution[],
    faculties: faculties.data as Faculty[],
    departments: departments.data as Department[],
    courses: courses.data as Course[],
  };
}

// Room list for the admin panel: metadata + course + member/message counts
// only — never message content. Combines a rooms+courses query with the
// admin_room_stats() RPC (the only path to counts, since messages has no
// super_admin SELECT policy) and merges them in JS.
export async function listAllRooms(
  client: SupabaseClient,
  filters: { search?: string; status?: "active" | "closed" } = {},
): Promise<AdminRoomListItem[]> {
  let query = client.from("rooms").select("id, name, status, course:courses(id, name, code)");
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
      status: "active" | "closed";
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
