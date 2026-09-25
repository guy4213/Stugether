"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitation, declineInvitation } from "@/lib/repositories/invitations";
import { getCurrentUser } from "@/lib/auth/session";

export type ActionResult = { ok: boolean; error?: string };

export async function acceptRoomInvitation(invitationId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    const roomId = await acceptInvitation(supabase, invitationId);
    if (!roomId) return { ok: false, error: "תוקף ההזמנה פג" };
  } catch {
    return { ok: false, error: "לא ניתן היה לאשר את ההזמנה" };
  }
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function declineRoomInvitation(invitationId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await declineInvitation(supabase, invitationId);
  } catch {
    return { ok: false, error: "משהו השתבש" };
  }
  revalidatePath("/notifications");
  return { ok: true };
}
