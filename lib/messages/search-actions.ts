"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  listDirectMessagesBetween,
  searchDirectMessages,
  type DirectMessage,
  type DirectMessageCursor,
} from "@/lib/repositories/conversations";
import { getCurrentUser } from "@/lib/auth/session";

// "חיפוש בשיחה" in a private chat (client QA 12.11.2026). RLS keeps it to the
// two participants of the conversation.

const uuid = z.guid();
const query = z.string().trim().min(2).max(100);
const cursor = z.object({ createdAt: z.iso.datetime({ offset: true }), id: uuid });

export async function searchDirectMessagesAction(
  conversationId: string,
  q: string,
): Promise<{ ok: boolean; error?: string; hits?: DirectMessage[] }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const parsed = query.safeParse(q);
  if (!uuid.safeParse(conversationId).success || !parsed.success) {
    return { ok: false, error: "חיפוש של 2 תווים לפחות" };
  }
  const supabase = await createClient();
  try {
    return { ok: true, hits: await searchDirectMessages(supabase, conversationId, parsed.data) };
  } catch {
    return { ok: false, error: "החיפוש נכשל" };
  }
}

export async function loadDirectMessagesFrom(
  conversationId: string,
  from: DirectMessageCursor,
  until: DirectMessageCursor,
): Promise<DirectMessage[]> {
  const user = await getCurrentUser();
  if (!user || !uuid.safeParse(conversationId).success) return [];
  if (!cursor.safeParse(from).success || !cursor.safeParse(until).success) return [];
  const supabase = await createClient();
  try {
    return await listDirectMessagesBetween(supabase, conversationId, from, until);
  } catch {
    return [];
  }
}
