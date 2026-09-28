"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { setUserActive, updateAppSettings } from "@/lib/repositories/admin";
import {
  createCourse,
  createDepartment,
  createInstitution,
  updateCourse,
  updateDepartment,
  updateInstitution,
} from "@/lib/repositories/catalog";
import { setRoomStatus } from "@/lib/repositories/rooms";
import { requireSuperAdmin } from "@/lib/admin/queries";

// Super Admin writes. RLS + the profile guard trigger are the real gate (a
// student calling these gets a Postgres error); requireSuperAdmin() just
// fails fast with a clear message.

export type AdminActionResult = { ok: boolean; error?: string };

const NOT_ALLOWED: AdminActionResult = { ok: false, error: "אין הרשאה" };

async function guarded(
  paths: string[],
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, userId: string) => Promise<unknown>,
  errorMessage = "הפעולה נכשלה",
): Promise<AdminActionResult> {
  const admin = await requireSuperAdmin();
  if (!admin) return NOT_ALLOWED;
  const supabase = await createClient();
  try {
    await fn(supabase, admin.userId);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") return { ok: false, error: "כבר קיים פריט בשם הזה" };
    return { ok: false, error: errorMessage };
  }
  for (const p of paths) revalidatePath(p);
  return { ok: true };
}

// --- users -------------------------------------------------------------------

export async function setUserActiveAction(
  userId: string,
  isActive: boolean,
): Promise<AdminActionResult> {
  return guarded(["/admin/users", "/admin"], async (supabase, adminId) => {
    if (userId === adminId) throw new Error("SELF");
    await setUserActive(supabase, userId, isActive);
  });
}

// --- catalog -----------------------------------------------------------------

const nameSchema = z.string().trim().min(1).max(200);
const optionalText = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export async function createInstitutionAction(input: {
  name: string;
  city?: string | null;
}): Promise<AdminActionResult> {
  const parsed = z.object({ name: nameSchema, city: optionalText }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "יש למלא שם" };
  return guarded(["/admin/catalog"], (s) => createInstitution(s, parsed.data));
}

export async function createDepartmentAction(input: {
  institutionId: string;
  name: string;
}): Promise<AdminActionResult> {
  const parsed = z.object({ institutionId: z.string().uuid(), name: nameSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "יש לבחור מוסד ולמלא שם" };
  return guarded(["/admin/catalog"], (s) => createDepartment(s, parsed.data));
}

const courseSchema = z.object({
  institutionId: z.string().uuid(),
  departmentId: z.string().uuid().nullable().optional(),
  code: optionalText,
  name: nameSchema,
  yearLevel: z.number().int().min(1).max(7).nullable().optional(),
  semester: optionalText,
});

export async function createCourseAction(
  input: z.input<typeof courseSchema>,
): Promise<AdminActionResult> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "יש לבחור מוסד ולמלא שם קורס" };
  return guarded(["/admin/catalog", "/courses"], (s) => createCourse(s, parsed.data));
}

export async function updateCatalogItemAction(
  kind: "institution" | "department" | "course",
  id: string,
  patch: { name?: string; isActive?: boolean; code?: string | null },
): Promise<AdminActionResult> {
  const parsed = z
    .object({
      name: nameSchema.optional(),
      isActive: z.boolean().optional(),
      code: optionalText,
    })
    .safeParse(patch);
  if (!parsed.success) return { ok: false, error: "ערך לא תקין" };
  const data = parsed.data;
  return guarded(["/admin/catalog", "/courses"], (s) => {
    if (kind === "institution") {
      return updateInstitution(s, id, { name: data.name, isActive: data.isActive });
    }
    if (kind === "department") {
      return updateDepartment(s, id, { name: data.name, isActive: data.isActive });
    }
    return updateCourse(s, id, { name: data.name, isActive: data.isActive, code: data.code });
  });
}

// --- rooms (metadata only) -----------------------------------------------------

export async function archiveRoomAction(roomId: string): Promise<AdminActionResult> {
  return guarded(
    ["/admin/rooms", "/admin"],
    (s) => setRoomStatus(s, roomId, "archived"),
    "לא ניתן לארכב את החדר",
  );
}

// --- AI ----------------------------------------------------------------------------

export async function updateAiSettingsAction(input: {
  systemPrompt?: string;
  aiEnabled?: boolean;
}): Promise<AdminActionResult> {
  const parsed = z
    .object({
      systemPrompt: z.string().trim().min(1).max(20000).optional(),
      aiEnabled: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "ה-system prompt לא יכול להיות ריק" };
  return guarded(["/admin/ai"], (s, userId) => updateAppSettings(s, userId, parsed.data));
}
