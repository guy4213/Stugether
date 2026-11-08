"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { enroll, setEnrollmentCompleted, unenroll } from "@/lib/repositories/enrollments";
import { createRoom } from "@/lib/repositories/rooms";
import { setRoomTopics } from "@/lib/repositories/topics";
import { proposeRoomSession } from "@/lib/repositories/sessions";
import { z } from "zod";
import { createTest, type EventKind } from "@/lib/repositories/tests";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";

export type ActionResult = { ok: boolean; error?: string };

export async function enrollInCourse(courseId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
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
  if (user?.demo) return DEMO_READ_ONLY;
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

// "סימון כהושלם" / "ביטול הסימון" from the course card menu.
export async function setCourseCompleted(
  courseId: string,
  completed: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await setEnrollmentCompleted(supabase, user.id, courseId, completed);
  } catch {
    return { ok: false, error: "משהו השתבש" };
  }
  revalidatePath("/courses");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/profile");
  return { ok: true };
}

// Creates the room then navigates straight into it — redirect() throws, so
// this never returns a normal ActionResult on success. topicIds link syllabus
// topics (set_room_topics also writes their titles into rooms.topic).
// The opening time (Change Request 07.11.2026, "חדר לימוד חדש"): a future
// time becomes the room's first scheduled session; the goal is its note.
const RoomScheduleSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  durationMin: z.number().int().min(15).max(480),
  goal: z.string().trim().max(200).nullable(),
});
export type RoomSchedule = z.infer<typeof RoomScheduleSchema>;

export async function createRoomForCourse(
  courseId: string,
  name: string,
  topic: string,
  isOpen = false,
  topicIds: string[] = [],
  schedule: RoomSchedule | null = null,
): Promise<ActionResult> {
  if (topicIds.length > 10) return { ok: false, error: "אפשר לבחור עד 10 נושאים" };
  const plan = schedule ? RoomScheduleSchema.safeParse(schedule) : null;
  if (plan && !plan.success) return { ok: false, error: "מועד הפתיחה אינו תקין" };
  if (plan?.success && Date.parse(plan.data.startsAt) <= Date.now()) {
    return { ok: false, error: "מועד הפתיחה כבר עבר" };
  }
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
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

  if (topicIds.length > 0) {
    try {
      await setRoomTopics(supabase, room.id, topicIds);
    } catch {
      // The room exists; without the links it still works as a general room.
    }
  }

  if (plan?.success) {
    try {
      // One time = scheduled right away (propose_room_session).
      await proposeRoomSession(supabase, {
        roomId: room.id,
        options: [plan.data.startsAt],
        durationMin: plan.data.durationMin,
        note: plan.data.goal || null,
      });
    } catch {
      // The room exists; the session can be set again from the room.
    }
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
  if (user?.demo) return DEMO_READ_ONLY;
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
