import "server-only";
import { getCachedOwnProfile } from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import { listInstitutions, listFaculties, listDepartments } from "@/lib/repositories/catalog";
import { countActiveClassmates, listMyEnrollments } from "@/lib/repositories/enrollments";
import { listMyMessageTimestamps } from "@/lib/repositories/messages";
import { listMyTopicProgress } from "@/lib/repositories/topics";
import { timed } from "@/lib/perf/timing";
import { computeStreak } from "@/lib/stats/streak";

// Server-only aggregate for the profile settings page — kept out of
// app/**/page.tsx per the ESLint Supabase boundary (eslint.config.mjs).
export function getProfileFormData(userId: string) {
  return timed("page.profile", loadProfileFormData(userId));
}

async function loadProfileFormData(userId: string) {
  const supabase = await createClient();
  const since60 = new Date(Date.now() - 60 * 86_400_000).toISOString();
  // Every query starts as soon as what it needs has arrived: faculties and
  // departments wait only for my profile, classmates only for my enrollments.
  const pProfile = getCachedOwnProfile(userId);
  const pEnrollments = listMyEnrollments(supabase, userId);
  const pInstitutionId = pProfile.then((p) => p?.institution_id ?? null);
  const [
    profile,
    institutions,
    enrollments,
    partners,
    messageTimes,
    progress,
    faculties,
    departments,
  ] = await Promise.all([
    pProfile,
    listInstitutions(supabase),
    pEnrollments,
    pEnrollments.then((rows) =>
      countActiveClassmates(
        supabase,
        userId,
        rows.filter((e) => e.status === "active").map((e) => e.course_id),
      ),
    ),
    listMyMessageTimestamps(supabase, userId, since60),
    listMyTopicProgress(supabase, userId),
    pInstitutionId.then((id) => (id ? listFaculties(supabase, id) : [])),
    pInstitutionId.then((id) => (id ? listDepartments(supabase, id) : [])),
  ]);

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
