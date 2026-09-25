import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listMyEnrollments } from "@/lib/repositories/enrollments";
import { listMyActiveRooms } from "@/lib/repositories/rooms";
import { listMyMessageTimestamps } from "@/lib/repositories/messages";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listDepartments } from "@/lib/repositories/catalog";

const WEEKS = 8;
const WEEK_MS = 7 * 86_400_000;

export async function getAnalyticsData(userId: string) {
  const supabase = await createClient();
  const since = new Date(Date.now() - WEEKS * WEEK_MS);
  const [enrollments, activeRooms, messageTimes, profile] = await Promise.all([
    listMyEnrollments(supabase, userId),
    listMyActiveRooms(supabase, userId),
    listMyMessageTimestamps(supabase, userId, since.toISOString()),
    getOwnProfile(supabase, userId),
  ]);
  const departments = profile?.institution_id
    ? await listDepartments(supabase, profile.institution_id)
    : [];

  const activeCourses = enrollments.filter((e) => e.status === "active" && !e.completed_at);
  const completedCourses = enrollments.filter((e) => e.completed_at !== null);

  // Messages sent per week, oldest → newest.
  const weekly = Array.from({ length: WEEKS }, (_, i) => {
    const start = since.getTime() + i * WEEK_MS;
    return {
      weekStart: new Date(start).toISOString(),
      count: messageTimes.filter((t) => {
        const ms = new Date(t).getTime();
        return ms >= start && ms < start + WEEK_MS;
      }).length,
    };
  });

  // Enrolled courses grouped by department (the mockup's subject donut).
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));
  const bySubject = new Map<string, number>();
  for (const e of enrollments.filter((x) => x.status === "active")) {
    const name = (e.course.department_id && departmentName.get(e.course.department_id)) || "אחר";
    bySubject.set(name, (bySubject.get(name) ?? 0) + 1);
  }

  const roomsCreated = activeRooms.filter((r) => r.created_by === userId).length;

  return {
    activeCourses,
    completedCourses,
    activeRoomsCount: activeRooms.length,
    messagesSent: messageTimes.length,
    weekly,
    subjects: [...bySubject.entries()].map(([name, count]) => ({ name, count })),
    achievements: [
      {
        title: "צעד ראשון",
        description: "הצטרפת לחדר לימוד ראשון",
        earned: activeRooms.length > 0,
      },
      { title: "מוביל/ה", description: "פתחת חדר לימוד", earned: roomsCreated > 0 },
      {
        title: "חברותי/ת",
        description: "שלחת 10 הודעות ומעלה",
        earned: messageTimes.length >= 10,
      },
      {
        title: "סיום קורס",
        description: "השלמת קורס מלא",
        earned: completedCourses.length > 0,
      },
    ],
  };
}
