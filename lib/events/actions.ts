"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setEventRegistration } from "@/lib/repositories/tests";
import { getCurrentUser } from "@/lib/auth/session";

export type ActionResult = { ok: boolean; error?: string };

export async function toggleEventRegistration(
  courseId: string,
  eventId: string,
  registered: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await setEventRegistration(supabase, user.id, eventId, registered);
  } catch {
    return { ok: false, error: "יש להירשם לקורס כדי להירשם לאירוע" };
  }
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
