"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitation, declineInvitation } from "@/lib/repositories/invitations";
import {
  markNotificationsRead,
  setNotificationPreference,
  type NotificationPreferenceKey,
} from "@/lib/repositories/notifications";
import { getCurrentUser } from "@/lib/auth/session";

export type ActionResult = { ok: boolean; error?: string };

const PREFERENCE_KEYS: NotificationPreferenceKey[] = [
  "live_rooms",
  "messages_invites",
  "course_recs",
  "system_updates",
];

function revalidateNotificationViews() {
  // The unread badge lives in the (app) layout, so refresh the whole group.
  revalidatePath("/", "layout");
}

export async function acceptRoomInvitation(
  invitationId: string,
  notificationId?: string,
): Promise<ActionResult & { roomId?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  let roomId: string | null;
  try {
    roomId = await acceptInvitation(supabase, invitationId);
    if (notificationId) await markNotificationsRead(supabase, [notificationId]);
    if (!roomId) return { ok: false, error: "תוקף ההזמנה פג" };
  } catch {
    return { ok: false, error: "לא ניתן היה לאשר את ההזמנה" };
  }
  revalidateNotificationViews();
  return { ok: true, roomId };
}

export async function declineRoomInvitation(
  invitationId: string,
  notificationId?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await declineInvitation(supabase, invitationId);
    if (notificationId) await markNotificationsRead(supabase, [notificationId]);
  } catch {
    return { ok: false, error: "משהו השתבש" };
  }
  revalidateNotificationViews();
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await markNotificationsRead(supabase);
  } catch {
    return { ok: false, error: "משהו השתבש" };
  }
  revalidateNotificationViews();
  return { ok: true };
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await markNotificationsRead(supabase, [notificationId]);
  } catch {
    return { ok: false, error: "משהו השתבש" };
  }
  revalidateNotificationViews();
  return { ok: true };
}

export async function updateNotificationPreference(
  key: NotificationPreferenceKey,
  value: boolean,
): Promise<ActionResult> {
  if (!PREFERENCE_KEYS.includes(key)) return { ok: false, error: "הגדרה לא מוכרת" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await setNotificationPreference(supabase, user.id, key, value);
  } catch {
    return { ok: false, error: "לא ניתן לשמור את ההעדפה" };
  }
  revalidatePath("/notifications");
  return { ok: true };
}
