"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enroll, unenroll } from "@/lib/repositories/enrollments";
import { createRoom } from "@/lib/repositories/rooms";
import { createTest, type EventKind } from "@/lib/repositories/tests";
import { getCurrentUser } from "@/lib/auth/session";

export type ActionResult = { ok: boolean; error?: string };

export async function enrollInCourse(courseId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await enroll(supabase, user.id, courseId);
  } catch {
    return { ok: false, error: "לא ניתן להירשם לקורס" };
  }
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/profile");
  return { ok: true };
}

export async function unenrollFromCourse(courseId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await unenroll(supabase, user.id, courseId);
  } catch {
    return { ok: false, error: "משהו השתבש" };
  }
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/profile");
  return { ok: true };
}

// Creates the room then navigates straight into it — redirect() throws, so
// this never returns a normal ActionResult on success.
export async function createRoomForCourse(
  courseId: string,
  name: string,
  topic: string,
  isOpen = false,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();

  let room;
  try {
    room = await createRoom(supabase, {
      courseId,
      name,
      topic: topic || null,
      createdBy: user.id,
      isOpen,
    });
  } catch {
    return { ok: false, error: "לא ניתן ליצור חדר לימוד" };
  }

  redirect(`/rooms/${room.id}`);
}

export async function addTestForCourse(
  courseId: string,
  title: string,
  dueAt: string,
  kind: EventKind = "test",
  location = "",
): Promise<ActionResult> {
  if (!["test", "workshop", "study_session"].includes(kind)) {
    return { ok: false, error: "סוג אירוע לא חוקי" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await createTest(supabase, {
      courseId,
      title,
      dueAt: dueAt || null,
      createdBy: user.id,
      kind,
      location: location.trim() || null,
    });
  } catch {
    return { ok: false, error: "לא ניתן להוסיף את האירוע" };
  }
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
