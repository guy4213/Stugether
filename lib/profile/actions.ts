"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateOwnProfile } from "@/lib/repositories/profiles";
import { getCurrentUser } from "@/lib/auth/session";
import { DEMO_READ_ONLY } from "@/lib/demo/constants";
import { ISRAELI_CITIES } from "@/lib/constants/cities";
import {
  HOBBIES,
  LEARNING_STYLES,
  MAX_HOBBIES,
  MAX_LEARNING_STYLES,
  STUDY_TIMES,
  STUDY_TRACKS,
} from "@/lib/constants/profile-options";

const CITY_VALUES = [...ISRAELI_CITIES] as [string, ...string[]];

// z.guid(), not z.uuid(): zod 4's uuid() enforces RFC version/variant bits,
// which the fixed seed IDs (00000000-0000-0000-0001-...) don't have — every
// profile save against demo data failed validation silently.
const optionalId = z.guid().optional().or(z.literal(""));

const emptyToUndefined = (v: unknown) => (v === "" || v == null ? undefined : v);
// Chip groups post one comma-separated hidden field.
const csvToArray = (v: unknown) => (typeof v === "string" && v ? [...new Set(v.split(","))] : []);

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
  track: z.preprocess(emptyToUndefined, z.enum(STUDY_TRACKS).optional()),
  semester: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(3).optional()),
  hobbies: z.preprocess(csvToArray, z.array(z.enum(HOBBIES)).max(MAX_HOBBIES)),
  studyTimes: z.preprocess(csvToArray, z.array(z.enum(STUDY_TIMES))),
  learningStyles: z.preprocess(
    csvToArray,
    z.array(z.enum(LEARNING_STYLES)).max(MAX_LEARNING_STYLES),
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
  if (user?.demo) return DEMO_READ_ONLY;
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
      track: parsed.data.track ?? null,
      semester: parsed.data.semester ?? null,
      hobbies: parsed.data.hobbies,
      studyTimes: parsed.data.studyTimes,
      learningStyles: parsed.data.learningStyles,
    });
  } catch {
    return { ok: false, error: "שמירת הפרופיל נכשלה. נסו שוב" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateAvatarPath(avatarPath: string): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (user?.demo) return DEMO_READ_ONLY;
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
