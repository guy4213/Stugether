"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  listRoomMessagesBetween,
  searchRoomMessages,
  type Message,
  type MessageCursor,
} from "@/lib/repositories/messages";
import { getCurrentUser } from "@/lib/auth/session";

// "חיפוש בשיחה" in a study room (client QA 12.11.2026). Reads only — RLS
// (messages_select_member) keeps it to rooms the caller is a member of, so a
// Super Admin still never sees message content.

const uuid = z.guid();
const query = z.string().trim().min(2).max(100);
const cursor = z.object({ createdAt: z.iso.datetime({ offset: true }), id: uuid });

export type SearchResult<T> = { ok: boolean; error?: string; hits?: T[] };

export async function searchRoomMessagesAction(
  roomId: string,
  q: string,
): Promise<SearchResult<Message>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const parsed = query.safeParse(q);
  if (!uuid.safeParse(roomId).success || !parsed.success) {
    return { ok: false, error: "חיפוש של 2 תווים לפחות" };
  }
  const supabase = await createClient();
  try {
    return { ok: true, hits: await searchRoomMessages(supabase, roomId, parsed.data) };
  } catch {
    return { ok: false, error: "החיפוש נכשל" };
  }
}

// A search hit above what is on screen: everything from it up to the oldest
// loaded message, so the thread stays continuous.
export async function loadRoomMessagesFrom(
  roomId: string,
  from: MessageCursor,
  until: MessageCursor,
): Promise<Message[]> {
  const user = await getCurrentUser();
  if (!user || !uuid.safeParse(roomId).success) return [];
  if (!cursor.safeParse(from).success || !cursor.safeParse(until).success) return [];
  const supabase = await createClient();
  try {
    return await listRoomMessagesBetween(supabase, roomId, from, until);
  } catch {
    return [];
  }
}
