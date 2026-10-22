"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  cancelRoomSession,
  proposeRoomSession,
  rsvpRoomSession,
  scheduleRoomSession,
  voteRoomSession,
} from "@/lib/repositories/sessions";
import { setRoomStatus } from "@/lib/repositories/rooms";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";

// Planning a future session with the room's group (Change Request
// 13.10.2026). The RPCs enforce membership, roles and states.

export type SessionActionResult = { ok: boolean; error?: string };

const MESSAGES: [string, string][] = [
  ["OPTION_IN_PAST", "אחד המועדים כבר עבר"],
  ["BAD_OPTIONS", "בחרו בין מועד אחד לחמישה מועדים"],
  ["SESSION_NOT_OPEN", "המפגש כבר נקבע, התחיל או בוטל"],
  ["SESSION_EXISTS", "כבר נקבע מפגש בחדר. בטלו אותו כדי לקבוע אחר"],
  ["PROPOSAL_EXISTS", "יש כבר הצעה פתוחה בחדר. סמנו בה מועדים שמתאימים לכם"],
  ["ROOM_ARCHIVED_BY_ADMIN", "החדר אורכב ע״י מנהל המערכת ואי אפשר להפעיל אותו מחדש"],
  ["NOT_ALLOWED", "אין הרשאה לפעולה הזו"],
];

async function run(
  roomId: string,
  fn: (supabase: Awaited<ReturnType<typeof createClient>>) => Promise<unknown>,
) {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  try {
    await fn(await createClient());
  } catch (err) {
    const text = `${(err as { message?: string })?.message ?? ""}`;
    const hit = MESSAGES.find(([code]) => text.includes(code));
    return { ok: false, error: hit?.[1] ?? "הפעולה נכשלה. נסו שוב" };
  }
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

const ProposeSchema = z.object({
  options: z
    .array(z.iso.datetime({ offset: true }))
    .min(1)
    .max(5),
  durationMin: z.number().int().min(15).max(480),
  note: z.string().trim().max(200).nullable(),
});

export async function proposeSessionAction(
  roomId: string,
  input: { options: string[]; durationMin: number; note: string | null },
): Promise<SessionActionResult> {
  const parsed = ProposeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "המועדים שנבחרו אינם תקינים" };
  return run(roomId, (supabase) =>
    proposeRoomSession(supabase, {
      roomId,
      options: parsed.data.options,
      durationMin: parsed.data.durationMin,
      note: parsed.data.note || null,
    }),
  );
}

export async function voteSessionAction(roomId: string, optionId: string, vote: boolean) {
  return run(roomId, (supabase) => voteRoomSession(supabase, optionId, vote));
}

export async function scheduleSessionAction(roomId: string, optionId: string) {
  return run(roomId, (supabase) => scheduleRoomSession(supabase, optionId));
}

export async function rsvpSessionAction(
  roomId: string,
  sessionId: string,
  response: "accepted" | "declined",
) {
  return run(roomId, (supabase) => rsvpRoomSession(supabase, sessionId, response));
}

export async function cancelSessionAction(roomId: string, sessionId: string) {
  return run(roomId, (supabase) => cancelRoomSession(supabase, sessionId));
}

// "ללמוד שוב ביחד" in an archived room: the owner reactivates it first
// (set_room_status keeps its rules: not after admin moderation, owner enrolled).
export async function reactivateRoomAction(roomId: string): Promise<SessionActionResult> {
  return run(roomId, (supabase) => setRoomStatus(supabase, roomId, "active"));
}
