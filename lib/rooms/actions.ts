"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createRoom, joinOpenRoom, listMyActiveRooms } from "@/lib/repositories/rooms";
import { createInvitation } from "@/lib/repositories/invitations";
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
