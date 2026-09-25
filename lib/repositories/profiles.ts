import type { SupabaseClient } from "@supabase/supabase-js";

// Own full profile (profiles table, RLS: profiles_select_own_or_admin — only
// self or an active super_admin can read a full row) vs. the public mini
// profile of someone else (public_profiles VIEW — see getPublicProfile /
// listPublicProfiles below). Never read "profiles" for another user's row.

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  institution_id: string | null;
  department_id: string | null;
  study_year: number | null;
  city: string | null;
  role: "student" | "super_admin";
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  institution_id: string | null;
  department_id: string | null;
  study_year: number | null;
  city: string | null;
  last_seen_at: string | null;
}

export async function getOwnProfile(
  client: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

// Only the columns an owner may freely change (institution_id, department_id,
// study_year, city, full_name, avatar_url, bio). role/is_active are never
// touched here — a trigger (guard_profile_privileged_columns) rejects those
// changes from a non-admin anyway.
export async function updateOwnProfile(
  client: SupabaseClient,
  userId: string,
  input: {
    fullName?: string;
    bio?: string | null;
    avatarPath?: string | null;
    institutionId?: string | null;
    departmentId?: string | null;
    studyYear?: number | null;
    city?: string | null;
  },
): Promise<Profile> {
  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.avatarPath !== undefined) patch.avatar_url = input.avatarPath;
  if (input.institutionId !== undefined) patch.institution_id = input.institutionId;
  if (input.departmentId !== undefined) patch.department_id = input.departmentId;
  if (input.studyYear !== undefined) patch.study_year = input.studyYear;
  if (input.city !== undefined) patch.city = input.city;

  const { data, error } = await client
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

// Reads from the public_profiles VIEW (never "profiles"): visible for self,
// super_admin, course-mates and roommates only (see the view definition in
// 20260913000003_helpers_and_rls.sql).
export async function getPublicProfile(
  client: SupabaseClient,
  userId: string,
): Promise<PublicProfile | null> {
  const { data, error } = await client
    .from("public_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as PublicProfile | null;
}

// Presence heartbeat for "online" badges. Throttled by the caller (the app
// shell) so a page view writes at most once every couple of minutes.
export async function touchLastSeen(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function listPublicProfiles(
  client: SupabaseClient,
  userIds: string[],
): Promise<PublicProfile[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await client.from("public_profiles").select("*").in("id", userIds);
  if (error) throw error;
  return data as PublicProfile[];
}
