"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { blockUser, unblockUser } from "@/lib/repositories/blocks";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";

export type BlockActionResult = { ok: boolean; error?: string };

// z.guid(), not z.uuid(): the seed IDs don't carry RFC version bits.
const uuid = z.guid();

function revalidateBlocks(otherId: string) {
  revalidatePath("/students");
  revalidatePath(`/students/${otherId}`);
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/messages", "layout");
  revalidatePath("/courses", "layout");
}

// "חסימה" on a student's profile or in the private chat (client QA 14.11.2026).
export async function blockUserAction(otherId: string): Promise<BlockActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  if (!uuid.safeParse(otherId).success || otherId === user.id) {
    return { ok: false, error: "לא ניתן לחסום את עצמך" };
  }
  try {
    await blockUser(await createClient(), otherId);
  } catch (err) {
    const m = (err as { message?: string } | null)?.message ?? "";
    if (m.includes("NOT_ALLOWED")) return { ok: false, error: "לא ניתן לחסום את המשתמש הזה" };
    return { ok: false, error: "החסימה נכשלה. נסו שוב" };
  }
  revalidateBlocks(otherId);
  return { ok: true };
}

export async function unblockUserAction(otherId: string): Promise<BlockActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  if (!uuid.safeParse(otherId).success) return { ok: false, error: "משהו השתבש" };
  try {
    await unblockUser(await createClient(), otherId);
  } catch {
    return { ok: false, error: "ביטול החסימה נכשל. נסו שוב" };
  }
  revalidateBlocks(otherId);
  return { ok: true };
}
