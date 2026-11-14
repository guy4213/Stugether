"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  leaveRoom,
  removeMember,
  setRoomStatus,
  updateRoom,
  watchRoomSeat,
} from "@/lib/repositories/rooms";
import { createInvitation, revokeInvitation } from "@/lib/repositories/invitations";
import {
  cancelRoomJoinRequest,
  decideRoomJoinRequest,
  requestRoomJoin,
} from "@/lib/repositories/join-requests";
import {
  listRoomMessages,
  markRoomRead,
  softDeleteMessage,
  type Message,
  type MessageCursor,
} from "@/lib/repositories/messages";
import { removeRoomFiles } from "@/lib/storage/server";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";
import { sendRoomInvitationEmails } from "@/lib/email/invitations";

export type ActionResult = { ok: boolean; error?: string };
export type JoinResult = ActionResult & { requested?: boolean };

// Origin for links in emails: SITE_URL when set (production — a forged Host
// header must not end up in a real email), else the request's own origin.
async function requestOrigin(): Promise<string> {
  const site = process.env.SITE_URL?.replace(/\/+$/, "");
  if (site) return site;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Invitation emails go out after the response; the invite itself is done.
async function emailInvitees(roomId: string, inviterId: string, inviteeIds: string[]) {
  const origin = await requestOrigin();
  after(() =>
    sendRoomInvitationEmails({ roomId, inviterId, inviteeIds, origin }).catch((err) =>
      console.error("[email] invitation emails failed", err),
    ),
  );
}

function errorCode(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  return `${e?.code ?? ""} ${e?.message ?? ""}`;
}

// Join an open room of one of my courses, then go straight into it. A room
// that is in session asks its creator first ({ requested: true }).
// redirect() throws, so a direct join never returns.
export async function joinOpenRoomAction(roomId: string): Promise<JoinResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    const outcome = await requestRoomJoin(supabase, roomId);
    if (outcome === "requested") {
      revalidatePath("/", "layout");
      return { ok: true, requested: true };
    }
  } catch (err) {
    const code = errorCode(err);
    if (code.includes("ROOM_FULL")) return { ok: false, error: "החדר מלא (4 משתתפים)" };
    if (code.includes("ROOM_NOT_ACTIVE")) return { ok: false, error: "החדר כבר לא פעיל" };
    if (code.includes("REQUEST_DECLINED_RECENTLY")) {
      return { ok: false, error: "הבקשה נדחתה. אפשר לבקש שוב בעוד כמה דקות" };
    }
    return { ok: false, error: "לא ניתן להצטרף לחדר" };
  }
  revalidatePath("/", "layout");
  redirect(`/rooms/${roomId}`);
}

export async function cancelJoinRequestAction(roomId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await cancelRoomJoinRequest(supabase, roomId);
  } catch {
    return { ok: false, error: "ביטול הבקשה נכשל" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// Room owner: approve / decline a request to join a room in session.
export async function decideJoinRequestAction(
  requestId: string,
  approve: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  let outcome: Awaited<ReturnType<typeof decideRoomJoinRequest>>;
  try {
    outcome = await decideRoomJoinRequest(supabase, requestId, approve);
  } catch (err) {
    const code = errorCode(err);
    if (code.includes("ROOM_FULL")) return { ok: false, error: "החדר מלא (4 משתתפים)" };
    if (code.includes("REQUEST_NOT_PENDING")) return { ok: false, error: "הבקשה כבר טופלה" };
    if (code.includes("ROOM_NOT_ACTIVE")) return { ok: false, error: "החדר כבר לא פעיל" };
    if (code.includes("NOT_ROOM_OWNER")) return { ok: false, error: "רק מנהל/ת החדר יכול/ה לאשר" };
    return { ok: false, error: "הפעולה נכשלה. נסו שוב" };
  }
  revalidatePath("/", "layout");
  if (outcome === "unavailable") {
    return { ok: false, error: "הסטודנט/ית כבר לא רשום/ה לקורס. הבקשה בוטלה" };
  }
  return { ok: true };
}

// "הזמנה ללמידה" from a student's card / profile / the course page lives in
// lib/rooms/study-invite-actions.ts (a dialog with a preview, client QA 12.11.2026).

// Invite 1-3 classmates into a room from the room's members panel (SPEC §4.5).
// Every row is validated by the room_invitations INSERT policy
// (can_invite_to_room: same course, capacity, not already a member), so each
// invitee succeeds or fails on its own.
export async function inviteToRoom(
  roomId: string,
  inviteeIds: string[],
): Promise<ActionResult & { sent?: number }> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const ids = [...new Set(inviteeIds)].slice(0, 3);
  if (ids.length === 0) return { ok: false, error: "יש לבחור לפחות סטודנט/ית אחד/ת" };

  const supabase = await createClient();
  const invited: string[] = [];
  let duplicate = false;
  for (const inviteeUserId of ids) {
    try {
      await createInvitation(supabase, { roomId, inviterId: user.id, inviteeUserId });
      invited.push(inviteeUserId);
    } catch (err) {
      if (errorCode(err).includes("23505")) duplicate = true;
    }
  }
  const sent = invited.length;
  if (sent > 0) await emailInvitees(roomId, user.id, invited);
  revalidatePath(`/rooms/${roomId}`);
  if (sent === 0) {
    return {
      ok: false,
      error: duplicate ? "כבר נשלחה הזמנה" : "לא ניתן להזמין (החדר מלא או שהסטודנט/ית כבר בחדר)",
    };
  }
  return { ok: true, sent };
}

export async function revokeRoomInvitation(
  roomId: string,
  invitationId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await revokeInvitation(supabase, invitationId);
  } catch {
    return { ok: false, error: "לא ניתן לבטל את ההזמנה" };
  }
  revalidatePath(`/rooms/${roomId}`);
  return { ok: true };
}

// Own message, within 5 minutes (SPEC §4.6) — enforced by soft_delete_message.
export async function deleteMessage(messageId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await softDeleteMessage(supabase, messageId);
  } catch {
    return { ok: false, error: "אפשר למחוק הודעה רק בחמש הדקות הראשונות" };
  }
  return { ok: true };
}

// Room-level read status (SPEC §4.6): sets my last_read_at. Called on open and
// whenever new messages arrive while the room is on screen.
export async function markRoomReadAction(roomId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false };
  const supabase = await createClient();
  try {
    await markRoomRead(supabase, roomId);
  } catch {
    return { ok: false };
  }
  return { ok: true };
}

// Keyset pagination backwards ("טעינת הודעות קודמות"). Returned oldest-first.
export async function loadOlderMessages(roomId: string, before: MessageCursor): Promise<Message[]> {
  const user = await getCurrentUser();
  if (user?.demo) return [];
  if (!user) return [];
  const supabase = await createClient();
  const rows = await listRoomMessages(supabase, roomId, { before, limit: 50 });
  return [...rows].reverse();
}

export async function leaveRoomAction(roomId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  let result;
  try {
    result = await leaveRoom(supabase, roomId);
  } catch {
    return { ok: false, error: "לא ניתן לעזוב את החדר" };
  }
  // The owner left: the room is gone (SPEC §8 #5), clean up its files too.
  if (result.roomDeleted) await removeRoomFiles(roomId, result.filePaths);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Owner only (remove_room_member enforces it).
export async function removeRoomMember(roomId: string, userId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await removeMember(supabase, roomId, userId);
  } catch {
    return { ok: false, error: "לא ניתן להסיר את המשתתף/ת" };
  }
  revalidatePath(`/rooms/${roomId}`);
  return { ok: true };
}

// Owner (or super_admin): close the room — read-only, never reopens (SPEC §3;
// archiving was removed, client QA 12.11.2026). set_room_status enforces it.
export async function setRoomStatusAction(roomId: string, status: "closed"): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await setRoomStatus(supabase, roomId, status);
  } catch {
    return { ok: false, error: "לא ניתן לעדכן את סטטוס החדר" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setRoomAiEnabled(roomId: string, aiEnabled: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await updateRoom(supabase, roomId, { aiEnabled });
  } catch {
    return { ok: false, error: "רק יוצר/ת החדר יכול/ה לשנות את ההגדרה" };
  }
  revalidatePath(`/rooms/${roomId}`);
  return { ok: true };
}

// "הגדרות החדר" (client QA 12.11.2026): the owner renames the room, edits its
// topic, and opens / closes it to classmates. update_room enforces who.
const RoomDetailsSchema = z.object({
  name: z.string().trim().min(1, "שם החדר ריק").max(100, "שם ארוך מדי").optional(),
  topic: z.string().max(500, "הנושא ארוך מדי").optional(),
  isOpen: z.boolean().optional(),
});

export async function updateRoomDetailsAction(
  roomId: string,
  input: { name?: string; topic?: string; isOpen?: boolean },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const parsed = RoomDetailsSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const supabase = await createClient();
  try {
    await updateRoom(supabase, roomId, parsed.data);
  } catch (err) {
    if (errorCode(err).includes("ROOM_NOT_ACTIVE")) return { ok: false, error: "החדר סגור" };
    return { ok: false, error: "רק יוצר/ת החדר יכול/ה לשנות את ההגדרות" };
  }
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

// "עדכנו כשמתפנה" on a full open room of one of my courses.
export async function watchRoomSeatAction(roomId: string, watch: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await watchRoomSeat(supabase, roomId, watch);
  } catch {
    return { ok: false, error: "לא ניתן לעקוב אחרי החדר הזה" };
  }
  revalidatePath("/rooms");
  return { ok: true };
}
