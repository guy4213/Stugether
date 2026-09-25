"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setTopicStatus, type TopicStatus } from "@/lib/repositories/topics";
import { getCurrentUser } from "@/lib/auth/session";

export type ActionResult = { ok: boolean; error?: string };

// Marks a course topic as started / mastered / not started. The DB trigger
// recomputes enrollments.progress_percent, which every progress view reads.
export async function updateTopicStatus(
  courseId: string,
  topicId: string,
  status: TopicStatus | null,
): Promise<ActionResult> {
  if (status !== null && status !== "in_progress" && status !== "mastered") {
    return { ok: false, error: "סטטוס לא חוקי" };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };
  const supabase = await createClient();
  try {
    await setTopicStatus(supabase, user.id, topicId, status);
  } catch {
    return { ok: false, error: "יש להירשם לקורס כדי לעדכן התקדמות" };
  }
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  revalidatePath("/profile");
  return { ok: true };
}
