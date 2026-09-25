import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listInstitutions, listFaculties, listDepartments } from "@/lib/repositories/catalog";
import { listMyEnrollments } from "@/lib/repositories/enrollments";

// Server-only aggregate for the profile settings page — kept out of
// app/**/page.tsx per the ESLint Supabase boundary (eslint.config.mjs).
export async function getProfileFormData(userId: string) {
  const supabase = await createClient();
  const [profile, institutions, enrollments] = await Promise.all([
    getOwnProfile(supabase, userId),
    listInstitutions(supabase),
    listMyEnrollments(supabase, userId),
  ]);

  const institutionId = profile?.institution_id ?? null;
  const [faculties, departments] = institutionId
    ? await Promise.all([
        listFaculties(supabase, institutionId),
        listDepartments(supabase, institutionId),
      ])
    : [[], []];

  return {
    profile,
    institutions,
    faculties,
    departments,
    activeCourses: enrollments.filter((e) => e.status === "active").map((e) => e.course),
  };
}
