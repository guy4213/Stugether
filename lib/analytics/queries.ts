import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listMyEnrollments } from "@/lib/repositories/enrollments";
import { listMyActiveRooms } from "@/lib/repositories/rooms";
import { listMyMessageTimestamps } from "@/lib/repositories/messages";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listDepartments } from "@/lib/repositories/catalog";

const WEEK_MS = 7 * 86_400_000;

export type AnalyticsRange = "8w" | "semester";

// "סמסטר" = ~20 weeks back (a semester plus exam period).
export function parseAnalyticsRange(value: string | undefined): AnalyticsRange {
  return value === "semester" ? "semester" : "8w";
}

export async function getAnalyticsData(userId: string, range: AnalyticsRange = "8w") {
  const weeks = range === "semester" ? 20 : 8;
  const supabase = await createClient();
  const since = new Date(Date.now() - weeks * WEEK_MS);
  const [enrollments, activeRooms, messageTimes, profile] = await Promise.all([
    listMyEnrollments(supabase, userId),
    listMyActiveRooms(supabase, userId),
    listMyMessageTimestamps(supabase, userId, since.toISOString()),
    getOwnProfile(supabase, userId),
  ]);
  const departments = profile?.institution_id
    ? await listDepartments(supabase, profile.institution_id)
    : [];

  const enrolled = enrollments.filter((e) => e.status === "active");
  const activeCourses = enrolled.filter((e) => !e.completed_at);
  const completedCourses = enrollments.filter((e) => e.completed_at !== null);

  // Messages sent per week, oldest → newest.
  const weekly = Array.from({ length: weeks }, (_, i) => {
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
  for (const e of enrolled) {
    const name = (e.course.department_id && departmentName.get(e.course.department_id)) || "אחר";
    bySubject.set(name, (bySubject.get(name) ?? 0) + 1);
  }

  const roomsCreated = activeRooms.filter((r) => r.created_by === userId).length;
  const avgActiveProgress = activeCourses.length
    ? Math.round(activeCourses.reduce((s, e) => s + e.progress_percent, 0) / activeCourses.length)
    : 0;

  // In-progress courses first, then completed ones.
  const courseProgress = [...enrolled]
    .sort((a, b) => Number(!!a.completed_at) - Number(!!b.completed_at) || b.progress_percent - a.progress_percent)
    .map((e) => ({
      id: e.course_id,
      name: e.course.name,
      progress: e.progress_percent,
      completed: e.completed_at !== null,
    }));

  return {
    range,
    weeks,
    activeCourses,
    completedCourses,
    enrolledCount: enrolled.length,
    activeRoomsCount: activeRooms.length,
    messagesSent: messageTimes.length,
    avgActiveProgress,
    weekly,
    courseProgress,
    subjects: [...bySubject.entries()].map(([name, count]) => ({ name, count })),
    achievements: [
      {
        title: "צעד ראשון",
        description: "הצטרפות לחדר ראשון",
        earned: activeRooms.length > 0,
      },
      { title: "מוביל/ה", description: "פתחת חדר לימוד", earned: roomsCreated > 0 },
      {
        title: "חברותי/ת",
        description: "10 הודעות ומעלה",
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
