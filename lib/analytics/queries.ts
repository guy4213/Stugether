import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listMyEnrollments } from "@/lib/repositories/enrollments";
import { listMyActiveRooms } from "@/lib/repositories/rooms";

export async function getAnalyticsData(userId: string) {
  const supabase = await createClient();
  const [enrollments, activeRooms] = await Promise.all([
    listMyEnrollments(supabase, userId),
    listMyActiveRooms(supabase, userId),
  ]);

  const activeCourses = enrollments.filter((e) => e.status === "active" && !e.completed_at);
  const completedCourses = enrollments.filter((e) => e.completed_at !== null);

  return { activeCourses, completedCourses, activeRoomsCount: activeRooms.length };
}
