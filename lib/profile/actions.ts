"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateOwnProfile } from "@/lib/repositories/profiles";
import { getCurrentUser } from "@/lib/auth/session";
import { ISRAELI_CITIES } from "@/lib/constants/cities";

const CITY_VALUES = [...ISRAELI_CITIES] as [string, ...string[]];

// z.guid(), not z.uuid(): zod 4's uuid() enforces RFC version/variant bits,
// which the fixed seed IDs (00000000-0000-0000-0001-...) don't have — every
// profile save against demo data failed validation silently.
const optionalId = z.guid().optional().or(z.literal(""));

const ProfileSchema = z.object({
  fullName: z.string().trim().min(1, "יש להזין שם מלא").max(120),
  bio: z.string().max(1000).optional().or(z.literal("")),
  institutionId: optionalId,
  departmentId: optionalId,
  city: z.enum(CITY_VALUES).optional().or(z.literal("")),
  // An unset <Select> posts "" — treat as "not chosen", not as 0.
  studyYear: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1).max(10).optional(),
  ),
});

export type ProfileFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };

  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "חלק מהשדות אינם תקינים",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  try {
    await updateOwnProfile(supabase, user.id, {
      fullName: parsed.data.fullName,
      bio: parsed.data.bio || null,
      institutionId: parsed.data.institutionId || null,
      departmentId: parsed.data.departmentId || null,
      city: parsed.data.city || null,
      studyYear: parsed.data.studyYear ?? null,
    });
  } catch {
    return { ok: false, error: "שמירת הפרופיל נכשלה. נסו שוב" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateAvatarPath(avatarPath: string): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };

  const supabase = await createClient();
  try {
    await updateOwnProfile(supabase, user.id, { avatarPath });
  } catch {
    return { ok: false, error: "עדכון התמונה נכשל" };
  }

  // Layout-level: the sidebar shows the avatar and name on every page.
  revalidatePath("/", "layout");
  return { ok: true };
}
