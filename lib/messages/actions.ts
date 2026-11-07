"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  DIRECT_MESSAGES_PAGE,
  listDirectMessages,
  markConversationRead,
  openConversation,
  sendDirectMessage,
  softDeleteDirectMessage,
  type DirectMessage,
  type DirectMessageCursor,
} from "@/lib/repositories/conversations";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";

export type ActionResult = { ok: boolean; error?: string };

// z.guid(), not z.uuid(): the seed IDs don't carry RFC version bits.
const uuid = z.guid();
const content = z.string().trim().min(1).max(4000);

function errorCode(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  return `${e?.code ?? ""} ${e?.message ?? ""}`;
}

// "שליחת הודעה" on a student's card / profile: open (or create) the private
// chat with them and go there. redirect() throws, so success never returns.
export async function startConversationAction(otherUserId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  if (!uuid.safeParse(otherUserId).success || otherUserId === user.id) {
    return { ok: false, error: "לא ניתן לפתוח שיחה" };
  }

  let conversationId: string;
  try {
    conversationId = await openConversation(await createClient(), otherUserId);
  } catch (err) {
    return errorCode(err).includes("NOT_ALLOWED")
      ? { ok: false, error: "אפשר לשלוח הודעות רק לסטודנטים פעילים" }
      : { ok: false, error: "לא ניתן לפתוח שיחה כרגע" };
  }
  redirect(`/messages/${conversationId}`);
}

export async function sendDirectMessageAction(
  conversationId: string,
  text: string,
): Promise<ActionResult & { message?: DirectMessage }> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const parsed = content.safeParse(text);
  if (!uuid.safeParse(conversationId).success || !parsed.success) {
    return { ok: false, error: "ההודעה ריקה או ארוכה מדי" };
  }

  try {
    const message = await sendDirectMessage(await createClient(), conversationId, parsed.data);
    return { ok: true, message };
  } catch (err) {
    const code = errorCode(err);
    if (code.includes("RATE_LIMITED")) {
      return { ok: false, error: "שלחת הרבה הודעות בדקה האחרונה. נסו שוב בעוד רגע" };
    }
    if (code.includes("RECIPIENT_UNAVAILABLE")) {
      return { ok: false, error: "החשבון של הסטודנט/ית לא פעיל כרגע" };
    }
    return { ok: false, error: "שליחת ההודעה נכשלה" };
  }
}

export async function deleteDirectMessageAction(messageId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  try {
    await softDeleteDirectMessage(await createClient(), messageId);
  } catch {
    return { ok: false, error: "אפשר למחוק הודעה רק בחמש הדקות הראשונות" };
  }
  return { ok: true };
}

// Called on open and whenever a message arrives while the chat is on screen.
// Also marks the conversation's in-site notification read.
export async function markConversationReadAction(conversationId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.demo) return { ok: false };
  try {
    await markConversationRead(await createClient(), conversationId);
  } catch {
    return { ok: false };
  }
  return { ok: true };
}

// "טעינת הודעות קודמות". Returned oldest-first.
export async function loadOlderDirectMessages(
  conversationId: string,
  before: DirectMessageCursor,
): Promise<DirectMessage[]> {
  const user = await getCurrentUser();
  if (!user || user.demo) return [];
  const rows = await listDirectMessages(await createClient(), conversationId, {
    before,
    limit: DIRECT_MESSAGES_PAGE,
  });
  return [...rows].reverse();
}
