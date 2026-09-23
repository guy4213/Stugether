"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateOwnProfile } from "@/lib/repositories/profiles";
import { getCurrentUser } from "@/lib/auth/session";
import { ISRAELI_CITIES } from "@/lib/constants/cities";

const CITY_VALUES = ISRAELI_CITIES.map((c) => c.value) as [string, ...string[]];

const ProfileSchema = z.object({
  fullName: z.string().trim().min(1, "יש להזין שם מלא").max(120),
  bio: z.string().max(1000).optional().or(z.literal("")),
  institutionId: z.string().uuid().optional().or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  city: z.enum(CITY_VALUES).optional().or(z.literal("")),
  studyYear: z.coerce.number().int().min(1).max(10).optional(),
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
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  await updateOwnProfile(supabase, user.id, {
    fullName: parsed.data.fullName,
    bio: parsed.data.bio || null,
    institutionId: parsed.data.institutionId || null,
    departmentId: parsed.data.departmentId || null,
    city: parsed.data.city || null,
    studyYear: parsed.data.studyYear ?? null,
  });

  revalidatePath("/profile");
  return { ok: true };
}

export async function updateAvatarPath(avatarPath: string): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "יש להתחבר מחדש" };

  const supabase = await createClient();
  await updateOwnProfile(supabase, user.id, { avatarPath });

  revalidatePath("/profile");
  return { ok: true };
}
