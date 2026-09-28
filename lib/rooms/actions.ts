"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createRoom,
  joinOpenRoom,
  leaveRoom,
  listMyActiveRooms,
  removeMember,
  setRoomStatus,
  updateRoom,
} from "@/lib/repositories/rooms";
import { createInvitation, revokeInvitation } from "@/lib/repositories/invitations";
import {
  listRoomMessages,
  markRoomRead,
  softDeleteMessage,
  type Message,
  type MessageCursor,
} from "@/lib/repositories/messages";
import { getCourse } from "@/lib/repositories/catalog";
import { getCurrentUser } from "@/lib/auth/session";

export type ActionResult = { ok: boolean; error?: string };

function errorCode(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  return `${e?.code ?? ""} ${e?.message ?? ""}`;
}

// Join an open room of one of my courses, then go straight into it.
// redirect() throws, so a successful call never returns.
export async function joinOpenRoomAction(roomId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await joinOpenRoom(supabase, roomId);
  } catch (err) {
    const code = errorCode(err);
    if (code.includes("ROOM_FULL")) return { ok: false, error: "החדר מלא (4 משתתפים)" };
    if (code.includes("ROOM_NOT_ACTIVE")) return { ok: false, error: "החדר כבר לא פעיל" };
    return { ok: false, error: "לא ניתן להצטרף לחדר" };
  }
  revalidatePath("/", "layout");
  redirect(`/rooms/${roomId}`);
}

// "הזמנה ללמידה": invite a classmate into my active room for this course, or
// open a fresh room for it first when I don't own one yet.
export async function inviteToStudy(
  courseId: string,
  inviteeId: string,
  topicTitle?: string | null,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();

  try {
    const myRooms = await listMyActiveRooms(supabase, user.id);
    let room = myRooms.find(
      (r) => r.course_id === courseId && r.status === "active" && r.created_by === user.id,
    );
    if (!room) {
      const course = await getCourse(supabase, courseId);
      room = await createRoom(supabase, {
        courseId,
        name: `לימוד ${topicTitle || course?.name || "משותף"}`.slice(0, 100),
        topic: topicTitle ?? null,
        createdBy: user.id,
      });
    }
    await createInvitation(supabase, {
      roomId: room.id,
      inviterId: user.id,
      inviteeUserId: inviteeId,
    });
  } catch (err) {
    const code = errorCode(err);
    if (code.includes("23505")) return { ok: false, error: "כבר נשלחה הזמנה" };
    if (code.includes("row-level security")) {
      return { ok: false, error: "לא ניתן להזמין (החדר מלא או שהסטודנט/ית כבר בחדר)" };
    }
    return { ok: false, error: "לא ניתן לשלוח הזמנה" };
  }
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// Invite 1-3 classmates into a room from the room's members panel (SPEC §4.5).
// Every row is validated by the room_invitations INSERT policy
// (can_invite_to_room: same course, capacity, not already a member), so each
// invitee succeeds or fails on its own.
export async function inviteToRoom(
  roomId: string,
  inviteeIds: string[],
): Promise<ActionResult & { sent?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const ids = [...new Set(inviteeIds)].slice(0, 3);
  if (ids.length === 0) return { ok: false, error: "יש לבחור לפחות סטודנט/ית אחד/ת" };

  const supabase = await createClient();
  let sent = 0;
  let duplicate = false;
  for (const inviteeUserId of ids) {
    try {
      await createInvitation(supabase, { roomId, inviterId: user.id, inviteeUserId });
      sent++;
    } catch (err) {
      if (errorCode(err).includes("23505")) duplicate = true;
    }
  }
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
  if (!user) return [];
  const supabase = await createClient();
  const rows = await listRoomMessages(supabase, roomId, { before, limit: 50 });
  return [...rows].reverse();
}

export async function leaveRoomAction(roomId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await leaveRoom(supabase, roomId);
  } catch {
    return { ok: false, error: "לא ניתן לעזוב את החדר" };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Owner only (remove_room_member enforces it).
export async function removeRoomMember(roomId: string, userId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
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

// Owner (or super_admin): archive / close. Both are read-only; a closed room
// never reopens (SPEC §3). set_room_status enforces the transitions.
export async function setRoomStatusAction(
  roomId: string,
  status: "archived" | "closed",
): Promise<ActionResult> {
  const user = await getCurrentUser();
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
