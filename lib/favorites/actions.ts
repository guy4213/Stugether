"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addFavorite, removeFavorite } from "@/lib/repositories/favorites";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";

export async function toggleFavorite(
  courseId: string,
  nextIsFavorite: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };

  const supabase = await createClient();
  try {
    if (nextIsFavorite) {
      await addFavorite(supabase, user.id, courseId);
    } else {
      await removeFavorite(supabase, user.id, courseId);
    }
  } catch {
    return { ok: false, error: "משהו השתבש" };
  }

  revalidatePath("/courses");
  return { ok: true };
}
