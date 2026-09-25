import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listInstitutions, listFaculties, listDepartments } from "@/lib/repositories/catalog";
import { countActiveClassmates, listMyEnrollments } from "@/lib/repositories/enrollments";
import { listMyMessageTimestamps } from "@/lib/repositories/messages";
import { listMyTopicProgress } from "@/lib/repositories/topics";
import { computeStreak } from "@/lib/stats/streak";

// Server-only aggregate for the profile settings page — kept out of
// app/**/page.tsx per the ESLint Supabase boundary (eslint.config.mjs).
export async function getProfileFormData(userId: string) {
  const supabase = await createClient();
  const since60 = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [profile, institutions, enrollments, partners, messageTimes, progress] = await Promise.all([
    getOwnProfile(supabase, userId),
    listInstitutions(supabase),
    listMyEnrollments(supabase, userId),
    countActiveClassmates(supabase, userId),
    listMyMessageTimestamps(supabase, userId, since60),
    listMyTopicProgress(supabase, userId),
  ]);

  const institutionId = profile?.institution_id ?? null;
  const [faculties, departments] = institutionId
    ? await Promise.all([
        listFaculties(supabase, institutionId),
        listDepartments(supabase, institutionId),
      ])
    : [[], []];

  const active = enrollments.filter((e) => e.status === "active");

  return {
    profile,
    institutions,
    faculties,
    departments,
    activeCourses: active.map((e) => ({
      ...e.course,
      progress: e.progress_percent,
      completed: e.completed_at !== null,
    })),
    stats: {
      courses: active.length,
      partners,
      streak: computeStreak([...messageTimes, ...progress.map((p) => p.updated_at)]),
    },
  };
}
