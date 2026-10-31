"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { completeOnboarding as completeOnboardingRpc } from "@/lib/repositories/onboarding";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";
import {
  HOBBIES,
  LEARNING_STYLES,
  MAX_LEARNING_STYLES,
  ONBOARDING_HOBBIES,
  ONBOARDING_TRACKS,
  STUDY_TIMES,
} from "@/lib/constants/profile-options";

// z.guid(), not z.uuid(): the seed IDs don't carry RFC version bits (see
// lib/profile/actions.ts).
const OnboardingSchema = z.object({
  fullName: z.string().trim().min(1, "יש להזין שם").max(120),
  institutionId: z.guid(),
  departmentId: z.guid(),
  studyYear: z.number().int().min(1).max(10),
  semester: z.number().int().min(1).max(3),
  track: z.enum(ONBOARDING_TRACKS),
  hobbies: z
    .array(z.enum(HOBBIES))
    .length(ONBOARDING_HOBBIES)
    .refine((a) => new Set(a).size === a.length),
  studyTimes: z.array(z.enum(STUDY_TIMES)).min(1),
  learningStyles: z
    .array(z.enum(LEARNING_STYLES))
    .length(MAX_LEARNING_STYLES)
    .refine((a) => new Set(a).size === a.length),
  courseIds: z.array(z.guid()).min(1, "יש לבחור לפחות קורס אחד").max(30),
});

// Plain shapes: the wizard's state as it is; the schema does the checking.
export interface OnboardingInput {
  fullName: string;
  institutionId: string;
  departmentId: string;
  studyYear: number | null;
  semester: number | null;
  track: string | null;
  hobbies: string[];
  studyTimes: string[];
  learningStyles: string[];
  courseIds: string[];
}
export type OnboardingResult =
  { ok: true; enrolled: number } | { ok: false; error: string; alreadyOnboarded?: boolean };

const RPC_ERRORS: Record<string, string> = {
  ALREADY_ONBOARDED: "ההרשמה כבר הושלמה",
  INVALID_DEPARTMENT: "המחלקה שנבחרה אינה זמינה. בחרו מחלקה אחרת",
  INVALID_COURSES: "חלק מהקורסים שנבחרו אינם זמינים. בחרו שוב",
  INVALID_ARGUMENT: "חלק מהתשובות חסרות. חזרו ובדקו",
};

export async function completeOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  const user = await getCurrentUser();
  if (user?.demo) return { ok: false, error: DEMO_READ_ONLY.error ?? "" };
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };

  const parsed = OnboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: RPC_ERRORS.INVALID_ARGUMENT };

  const supabase = await createClient();
  let enrolled: number;
  try {
    enrolled = await completeOnboardingRpc(supabase, parsed.data);
  } catch (err) {
    const code = err instanceof Object && "message" in err ? String(err.message) : "";
    return {
      ok: false,
      error: RPC_ERRORS[code] ?? "שמירת הפרטים נכשלה. נסו שוב",
      alreadyOnboarded: code === "ALREADY_ONBOARDED",
    };
  }

  // No revalidatePath: it would refresh /onboarding, which redirects a finished
  // student to /dashboard before the "הכל מוכן" step shows. The (app) pages are
  // dynamic, so the dashboard renders fresh on the way in.
  return { ok: true, enrolled };
}
