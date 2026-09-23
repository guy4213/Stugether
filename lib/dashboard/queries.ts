import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listMyActiveRooms } from "@/lib/repositories/rooms";
import { listMyEnrollments } from "@/lib/repositories/enrollments";
import { countActiveClassmates } from "@/lib/repositories/enrollments";
import { listPendingInvitations } from "@/lib/repositories/invitations";
import { listUpcomingTestsForUser } from "@/lib/repositories/tests";
import { getOwnProfile } from "@/lib/repositories/profiles";

export async function getDashboardData(userId: string) {
  const supabase = await createClient();
  const [profile, activeRooms, enrollments, pendingInvitations, activeStudentsCount, tests] =
    await Promise.all([
      getOwnProfile(supabase, userId),
      listMyActiveRooms(supabase, userId),
      listMyEnrollments(supabase, userId),
      listPendingInvitations(supabase),
      countActiveClassmates(supabase, userId),
      listUpcomingTestsForUser(supabase, userId),
    ]);

  const activeCourses = enrollments.filter((e) => e.status === "active");
  const courseNameById = new Map(activeCourses.map((e) => [e.course_id, e.course.name]));
  const continueLearning = [...activeCourses]
    .filter((e) => e.progress_percent < 100)
    .sort((a, b) => b.progress_percent - a.progress_percent)[0];

  return {
    profile,
    activeRooms,
    activeCourses,
    courseNameById,
    pendingInvitations,
    activeStudentsCount,
    tests,
    continueLearning,
  };
}
