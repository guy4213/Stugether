"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clearAvailability, setAvailability } from "@/lib/repositories/availability";
import { getCurrentUser } from "@/lib/auth/session";

export type ActionResult = { ok: boolean; error?: string };

const availabilitySchema = z.object({
  mode: z.enum(["online", "campus"]),
  durationMinutes: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]),
  activity: z.enum(["summaries", "exercises", "review", "exam_prep"]),
  topicId: z.uuid().nullable(),
});

export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export async function setStudyAvailability(
  courseId: string,
  input: AvailabilityInput,
): Promise<ActionResult> {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "פרטים לא תקינים" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await setAvailability(supabase, { userId: user.id, courseId, ...parsed.data });
  } catch {
    return { ok: false, error: "יש להירשם לקורס כדי לסמן זמינות" };
  }
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function clearStudyAvailability(courseId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await clearAvailability(supabase, user.id, courseId);
  } catch {
    return { ok: false, error: "משהו השתבש" };
  }
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
