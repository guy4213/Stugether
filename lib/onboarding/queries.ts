import "server-only";
import { getCachedOwnProfile } from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import { listInstitutions } from "@/lib/repositories/catalog";
import { getDemoScenario } from "@/lib/demo/state";
import { demoOnboarding } from "@/lib/demo/fixtures";

export interface OnboardingData {
  /** Finished the wizard (or not a student) — nothing to do here. */
  onboarded: boolean;
  /** Prefill for "what is your name" ("" = ask). */
  suggestedName: string;
  avatarPath: string | null;
  institutions: { id: string; name: string; city: string | null }[];
}

// Server-only data for the onboarding wizard (app/onboarding/page.tsx) — kept
// out of the page per the ESLint Supabase boundary.
// Demo mode: a preview of the wizard on the fixture catalog (nothing is saved).
export async function getOnboardingData(
  userId: string,
  email: string | null,
): Promise<OnboardingData | null> {
  if (await getDemoScenario()) return demoOnboarding();
  const supabase = await createClient();
  const [profile, institutions] = await Promise.all([
    getCachedOwnProfile(userId),
    listInstitutions(supabase),
  ]);
  if (!profile) return null;

  // handle_new_user falls back to the email's local part when signup gave no
  // name (email signup); don't offer that as "your name".
  const emailName = email?.split("@")[0] ?? "";
  const suggestedName = profile.full_name === emailName ? "" : profile.full_name;

  return {
    onboarded: profile.onboarded_at !== null || profile.role !== "student",
    suggestedName,
    avatarPath: profile.avatar_url,
    institutions: institutions.map((i) => ({ id: i.id, name: i.name, city: i.city })),
  };
}
