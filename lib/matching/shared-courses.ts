import type { SupabaseClient } from "@supabase/supabase-js";
import { listCourseRosters } from "@/lib/repositories/enrollments";

// user id → ids of the courses that user shares with me (both actively
// enrolled). Enrollment RLS already limits rows to courses I'm active in.
export async function sharedCoursesByUser(
  client: SupabaseClient,
  myActiveCourseIds: string[],
  myUserId: string,
): Promise<Map<string, string[]>> {
  const rows = await listCourseRosters(client, myActiveCourseIds);
  const byUser = new Map<string, string[]>();
  for (const { user_id, course_id } of rows) {
    if (user_id === myUserId) continue;
    const list = byUser.get(user_id);
    if (list) {
      if (!list.includes(course_id)) list.push(course_id);
    } else byUser.set(user_id, [course_id]);
  }
  return byUser;
}
