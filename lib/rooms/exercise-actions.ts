"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { addRoomExercise, getRoomExercise, type RoomExercise } from "@/lib/repositories/exercises";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY_ERROR } from "@/lib/demo/constants";

export type ExerciseActionResult =
  { ok: true; exercise: RoomExercise } | { ok: false; error: string };

const schema = z
  .object({
    roomId: z.string().uuid(),
    title: z.string().trim().min(1, "יש לתת שם לתרגיל").max(120, "השם ארוך מדי"),
    content: z.string().trim().max(20000, "התרגיל ארוך מדי").nullable(),
    file: z
      .object({
        path: z.string().min(1),
        name: z.string().trim().min(1).max(200),
        type: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
      })
      .nullable(),
  })
  .refine((v) => (v.content && v.content.length > 0) || v.file, {
    message: "יש להדביק את התרגיל או לצרף קובץ",
  });

// "העלאת תרגיל" (Change Request 30.10.2026): the file, if any, is already in
// the room's Storage folder (lib/storage uploadRoomFile); this records it.
export async function addExerciseAction(input: {
  roomId: string;
  title: string;
  content: string | null;
  file: { path: string; name: string; type: string } | null;
}): Promise<ExerciseActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return { ok: false, error: DEMO_READ_ONLY_ERROR };
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "פרטי התרגיל אינם תקינים" };
  }
  const supabase = await createClient();
  try {
    const id = await addRoomExercise(supabase, {
      roomId: parsed.data.roomId,
      title: parsed.data.title,
      content: parsed.data.content || null,
      file: parsed.data.file,
    });
    const exercise = await getRoomExercise(supabase, id);
    if (!exercise) throw new Error("NOT_FOUND");
    return { ok: true, exercise };
  } catch {
    return { ok: false, error: "לא ניתן להוסיף תרגיל לחדר הזה" };
  }
}
