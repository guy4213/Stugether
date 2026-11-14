import type { SupabaseClient } from "@supabase/supabase-js";

// Friends (20261112000010_friendships.sql). Reads go through RLS: accepted
// rows are public to active students, pending ones only to the two sides.
// Every write is an RPC.

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
}

/** How a friendship looks from one side. */
export type FriendStatus = "none" | "friends" | "outgoing" | "incoming";

export function friendStatusFor(f: Friendship | null | undefined, meId: string): FriendStatus {
  if (!f || f.status === "declined") return "none";
  if (f.status === "accepted") return "friends";
  return f.requester_id === meId ? "outgoing" : "incoming";
}

export function otherSide(f: Friendship, userId: string): string {
  return f.requester_id === userId ? f.addressee_id : f.requester_id;
}

// Every friendship row touching this user (that the caller may see).
export async function listFriendshipsOf(
  client: SupabaseClient,
  userId: string,
): Promise<Friendship[]> {
  const { data, error } = await client
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  return data as Friendship[];
}

export async function sendFriendRequest(
  client: SupabaseClient,
  userId: string,
): Promise<Friendship> {
  const { data, error } = await client.rpc("send_friend_request", { p_user_id: userId }).single();
  if (error) throw error;
  return data as Friendship;
}

export async function respondFriendRequest(
  client: SupabaseClient,
  friendshipId: string,
  accept: boolean,
): Promise<Friendship> {
  const { data, error } = await client
    .rpc("respond_friend_request", { p_friendship_id: friendshipId, p_accept: accept })
    .single();
  if (error) throw error;
  return data as Friendship;
}

export async function removeFriend(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.rpc("remove_friend", { p_user_id: userId });
  if (error) throw error;
}
