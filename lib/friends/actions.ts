"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  friendStatusFor,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  type FriendStatus,
} from "@/lib/repositories/friends";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";

export type FriendActionResult = { ok: boolean; error?: string; status?: FriendStatus };

// z.guid(), not z.uuid(): the seed IDs don't carry RFC version bits.
const uuid = z.guid();

function messageOf(err: unknown): string {
  const m = (err as { message?: string } | null)?.message ?? "";
  if (m.includes("RATE_LIMITED")) return "שלחת הרבה בקשות היום. נסו שוב מחר";
  if (m.includes("BLOCKED")) return "לא ניתן להוסיף: יש חסימה ביניכם";
  if (m.includes("NOT_ALLOWED")) return "לא ניתן להוסיף את המשתמש הזה";
  if (m.includes("FRIEND_REQUEST_NOT_PENDING")) return "הבקשה כבר טופלה";
  if (m.includes("FRIEND_REQUEST_NOT_FOUND")) return "הבקשה לא נמצאה";
  return "משהו השתבש";
}

function revalidateFriends(otherId: string) {
  revalidatePath("/profile");
  revalidatePath(`/students/${otherId}`);
  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

// "הוספת חבר": sends a request (or accepts theirs, if they asked first).
export async function sendFriendRequestAction(otherId: string): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  if (!uuid.safeParse(otherId).success || otherId === user.id) {
    return { ok: false, error: "לא ניתן להוסיף את עצמך" };
  }
  const supabase = await createClient();
  try {
    const row = await sendFriendRequest(supabase, otherId);
    revalidateFriends(otherId);
    return { ok: true, status: friendStatusFor(row, user.id) };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

// Accept / decline a request sent to me (the button, or the notification).
export async function respondFriendRequestAction(
  friendshipId: string,
  accept: boolean,
): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  if (!uuid.safeParse(friendshipId).success) return { ok: false, error: "הבקשה לא נמצאה" };
  const supabase = await createClient();
  try {
    const row = await respondFriendRequest(supabase, friendshipId, accept);
    revalidateFriends(row.requester_id);
    return { ok: true, status: friendStatusFor(row, user.id) };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

// "הסרה מהחברים" / "ביטול הבקשה".
export async function removeFriendAction(otherId: string): Promise<FriendActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  if (!uuid.safeParse(otherId).success) return { ok: false, error: "משהו השתבש" };
  const supabase = await createClient();
  try {
    await removeFriend(supabase, otherId);
    revalidateFriends(otherId);
    return { ok: true, status: "none" };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}
