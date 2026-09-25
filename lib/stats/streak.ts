const TIME_ZONE = "Asia/Jerusalem";

// "YYYY-MM-DD" of an instant in Israel time.
export function israelDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Consecutive days with any learning activity (messages sent, topic progress),
// ending today — or yesterday, so the streak doesn't read 0 first thing in the
// morning before today's first activity.
export function computeStreak(activityTimestamps: string[], now = new Date()): number {
  const days = new Set(activityTimestamps.map((t) => israelDayKey(new Date(t))));
  const dayMs = 86_400_000;

  let cursor = now.getTime();
  if (!days.has(israelDayKey(new Date(cursor)))) cursor -= dayMs;

  let streak = 0;
  while (days.has(israelDayKey(new Date(cursor)))) {
    streak += 1;
    cursor -= dayMs;
  }
  return streak;
}
