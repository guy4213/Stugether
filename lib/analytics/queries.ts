import "server-only";
import { getCachedMyActiveRooms } from "@/lib/app/cached";
import { createClient } from "@/lib/supabase/server";
import { listMyEnrollments } from "@/lib/repositories/enrollments";
import { listMyMessageRooms } from "@/lib/repositories/messages";
import { listRoomCourseIds } from "@/lib/repositories/rooms";
import { getDemoScenario } from "@/lib/demo/state";
import { demoAnalytics } from "@/lib/demo/fixtures";
import { rangeWeeks, type AnalyticsRange } from "@/lib/analytics/range";

const WEEK_MS = 7 * 86_400_000;

export { parseAnalyticsRange, type AnalyticsRange } from "@/lib/analytics/range";

export async function getAnalyticsData(
  userId: string,
  range: AnalyticsRange = "8w",
): Promise<AnalyticsData> {
  const demo = await getDemoScenario();
  if (demo) return demoAnalytics(demo, range);
  return loadAnalyticsData(userId, range);
}

export type AnalyticsData = Awaited<ReturnType<typeof loadAnalyticsData>>;

async function loadAnalyticsData(userId: string, range: AnalyticsRange) {
  const weeks = rangeWeeks(range);
  const supabase = await createClient();
  const since = new Date(Date.now() - weeks * WEEK_MS);
  const [enrollments, activeRooms, myMessages] = await Promise.all([
    listMyEnrollments(supabase, userId),
    getCachedMyActiveRooms(userId),
    listMyMessageRooms(supabase, userId, since.toISOString()),
  ]);
  const messageTimes = myMessages.map((m) => m.created_at);
  const roomCourse = await listRoomCourseIds(supabase, [
    ...new Set(myMessages.map((m) => m.room_id)),
  ]);

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

  // "פעילות לפי קורס" (client QA 12.11.2026, replaced the department donut):
  // my messages in the range, per course of the room they were sent in.
  const courseName = new Map(enrollments.map((e) => [e.course_id, e.course.name]));
  const byCourse = new Map<string, number>();
  for (const m of myMessages) {
    const courseId = roomCourse.get(m.room_id);
    if (courseId) byCourse.set(courseId, (byCourse.get(courseId) ?? 0) + 1);
  }
  const courseActivity = [...byCourse.entries()]
    .map(([id, messages]) => ({ id, name: courseName.get(id) ?? "קורס אחר", messages }))
    .sort((a, b) => b.messages - a.messages);

  const roomsCreated = activeRooms.filter((r) => r.created_by === userId).length;
  const avgActiveProgress = activeCourses.length
    ? Math.round(activeCourses.reduce((s, e) => s + e.progress_percent, 0) / activeCourses.length)
    : 0;

  // In-progress courses first, then completed ones.
  const courseProgress = [...enrolled]
    .sort(
      (a, b) =>
        Number(!!a.completed_at) - Number(!!b.completed_at) ||
        b.progress_percent - a.progress_percent,
    )
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
    courseActivity,
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
