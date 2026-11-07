import type { SupabaseClient } from "@supabase/supabase-js";

// 1:1 chat between two students (SPEC §5.1, migration 20261107000001).
// Reads are limited to the two participants by RLS; every write is an RPC.

export interface Conversation {
  id: string;
  user_a_id: string;
  user_b_id: string;
  last_message_at: string | null;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ConversationSummary {
  conversation_id: string;
  other_user_id: string;
  last_message_at: string;
  last_message_content: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
}

export interface DirectMessageCursor {
  createdAt: string;
  id: string;
}

export const DIRECT_MESSAGES_PAGE = 50;

// Wraps open_conversation(p_other_user_id): the pair's conversation id,
// created on first use.
export async function openConversation(
  client: SupabaseClient,
  otherUserId: string,
): Promise<string> {
  const { data, error } = await client.rpc("open_conversation", {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function getConversation(
  client: SupabaseClient,
  conversationId: string,
): Promise<Conversation | null> {
  const { data, error } = await client
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data as Conversation | null;
}

// Newest first, keyset on (created_at, id) — matches
// direct_messages_conversation_created_id_idx. RLS already hides the other
// participant's deleted messages.
export async function listDirectMessages(
  client: SupabaseClient,
  conversationId: string,
  options: { before?: DirectMessageCursor; limit?: number } = {},
): Promise<DirectMessage[]> {
  let query = client
    .from("direct_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(options.limit ?? DIRECT_MESSAGES_PAGE);

  if (options.before) {
    const { createdAt, id } = options.before;
    query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as DirectMessage[];
}

// Wraps send_direct_message: the message, last_message_at, my read mark and
// the recipient's in-site notification, in one transaction.
export async function sendDirectMessage(
  client: SupabaseClient,
  conversationId: string,
  content: string,
): Promise<DirectMessage> {
  const { data, error } = await client
    .rpc("send_direct_message", { p_conversation_id: conversationId, p_content: content })
    .single();
  if (error) throw error;
  return data as DirectMessage;
}

export async function markConversationRead(
  client: SupabaseClient,
  conversationId: string,
): Promise<void> {
  const { error } = await client.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

// Own message, within 5 minutes.
export async function softDeleteDirectMessage(
  client: SupabaseClient,
  messageId: string,
): Promise<void> {
  const { error } = await client.rpc("soft_delete_direct_message", { p_message_id: messageId });
  if (error) throw error;
}

export async function listMyConversations(client: SupabaseClient): Promise<ConversationSummary[]> {
  const { data, error } = await client.rpc("list_my_conversations");
  if (error) throw error;
  return (data as ConversationSummary[]).map((row) => ({
    ...row,
    unread_count: Number(row.unread_count),
  }));
}

// Conversations with something I haven't read — the nav badge.
export async function countUnreadConversations(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc("count_unread_direct_messages");
  if (error) throw error;
  return Number(data ?? 0);
}
