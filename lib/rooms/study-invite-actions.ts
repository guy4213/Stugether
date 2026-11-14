"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRoom, listActiveMembersOfRooms, listMyActiveRooms } from "@/lib/repositories/rooms";
import { createInvitation, listRoomPendingInvitations } from "@/lib/repositories/invitations";
import { getCourse } from "@/lib/repositories/catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";
import { sendRoomInvitationEmails } from "@/lib/email/invitations";

// "הזמנה ללמידה" as a dialog with a confirmation (client QA 11.2026). The
// dialog first asks where the invitation would go (previewStudyInvite), shows
// it, and only then sends (sendStudyInvite). Same room choice as before:
// a room of mine for the course with a free seat, else a new room.

const MAX_MEMBERS = 4;
const uuid = z.guid();

export type StudyInviteTarget =
  { kind: "existing"; roomId: string; roomName: string } | { kind: "new"; roomName: string };

export type PreviewResult = { ok: boolean; error?: string; target?: StudyInviteTarget };
export type SendResult = {
  ok: boolean;
  error?: string;
  roomId?: string;
  roomName?: string;
  created?: boolean;
};

function newRoomName(courseName: string | null | undefined, topicTitle?: string | null): string {
  return `לימוד ${topicTitle || courseName || "משותף"}`.slice(0, 100);
}

// Rooms I created for this course that still have a seat for the invitee
// (members + pending invitations < 4, and the invitee is not in or invited).
async function roomsWithSeat(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  inviteeId: string,
) {
  const mine = (await listMyActiveRooms(supabase, userId)).filter(
    (r) => r.course_id === courseId && r.status === "active" && r.created_by === userId,
  );
  if (mine.length === 0) return [];
  const members = await listActiveMembersOfRooms(
    supabase,
    mine.map((r) => r.id),
  );
  const result = [];
  for (const room of mine) {
    const inRoom = members.filter((m) => m.room_id === room.id);
    if (inRoom.some((m) => m.user_id === inviteeId)) continue;
    const pending = await listRoomPendingInvitations(supabase, room.id);
    if (pending.some((p) => p.invitee_user_id === inviteeId)) continue;
    if (inRoom.length + pending.length < MAX_MEMBERS) result.push(room);
  }
  return result;
}

export async function previewStudyInvite(
  courseId: string,
  inviteeId: string,
  topicTitle?: string | null,
): Promise<PreviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(inviteeId).success) {
    return { ok: false, error: "בקשה לא תקינה" };
  }
  if (user.demo) {
    return { ok: true, target: { kind: "new", roomName: newRoomName(null, topicTitle) } };
  }
  const supabase = await createClient();
  try {
    const [room] = await roomsWithSeat(supabase, user.id, courseId, inviteeId);
    if (room)
      return { ok: true, target: { kind: "existing", roomId: room.id, roomName: room.name } };
    const course = await getCourse(supabase, courseId);
    return { ok: true, target: { kind: "new", roomName: newRoomName(course?.name, topicTitle) } };
  } catch {
    return { ok: false, error: "לא ניתן לטעון את פרטי ההזמנה" };
  }
}

// Origin for links in emails (as in lib/rooms/actions.ts): SITE_URL when set.
async function requestOrigin(): Promise<string> {
  const site = process.env.SITE_URL?.replace(/\/+$/, "");
  if (site) return site;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function errorCode(err: unknown): string {
  const e = err as { message?: string; code?: string } | null;
  return `${e?.code ?? ""} ${e?.message ?? ""}`;
}

export async function sendStudyInvite(
  courseId: string,
  inviteeId: string,
  topicTitle?: string | null,
): Promise<SendResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(inviteeId).success) {
    return { ok: false, error: "בקשה לא תקינה" };
  }
  const supabase = await createClient();

  let roomId: string | null = null;
  let roomName = "";
  let created = false;
  try {
    for (const room of await roomsWithSeat(supabase, user.id, courseId, inviteeId)) {
      try {
        await createInvitation(supabase, {
          roomId: room.id,
          inviterId: user.id,
          inviteeUserId: inviteeId,
        });
        roomId = room.id;
        roomName = room.name;
        break;
      } catch (err) {
        // Filled up in the meantime: try the next one.
        if (!errorCode(err).includes("row-level security")) throw err;
      }
    }
    if (!roomId) {
      const course = await getCourse(supabase, courseId);
      const room = await createRoom(supabase, {
        courseId,
        name: newRoomName(course?.name, topicTitle),
        topic: topicTitle ?? null,
        createdBy: user.id,
      });
      await createInvitation(supabase, {
        roomId: room.id,
        inviterId: user.id,
        inviteeUserId: inviteeId,
      });
      roomId = room.id;
      roomName = room.name;
      created = true;
    }
  } catch (err) {
    const code = errorCode(err);
    if (code.includes("23505")) return { ok: false, error: "כבר נשלחה הזמנה" };
    if (code.includes("row-level security")) {
      return { ok: false, error: "לא ניתן להזמין (החדר מלא או שהסטודנט/ית כבר בחדר)" };
    }
    return { ok: false, error: "לא ניתן לשלוח הזמנה" };
  }

  const origin = await requestOrigin();
  const invitedRoom = roomId;
  after(() =>
    sendRoomInvitationEmails({
      roomId: invitedRoom,
      inviterId: user.id,
      inviteeIds: [inviteeId],
      origin,
    }).catch((err) => console.error("[email] invitation emails failed", err)),
  );
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/rooms");
  return { ok: true, roomId, roomName, created };
}
