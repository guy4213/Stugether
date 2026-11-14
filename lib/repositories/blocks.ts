import type { SupabaseClient } from "@supabase/supabase-js";

// Blocking a student (20261114000010_user_blocks.sql). The block itself is
// enforced in the DB (no private chat, no friend request); the app hides the
// two from each other's student lists with listHiddenUserIds.

export async function blockUser(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.rpc("block_user", { p_user_id: userId });
  if (error) throw error;
}

export async function unblockUser(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.rpc("unblock_user", { p_user_id: userId });
  if (error) throw error;
}

/** Everyone I blocked or who blocked me. */
export async function listHiddenUserIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.rpc("list_hidden_user_ids");
  if (error) throw error;
  return ((data as unknown[]) ?? []).map((r) =>
    typeof r === "string" ? r : (r as { list_hidden_user_ids: string }).list_hidden_user_ids,
  );
}

/** The students I blocked (RLS: own rows only), newest first. */
export async function listMyBlockedUsers(
  client: SupabaseClient,
): Promise<{ blocked_id: string; created_at: string }[]> {
  const { data, error } = await client
    .from("user_blocks")
    .select("blocked_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as { blocked_id: string; created_at: string }[];
}
