const nf = new Intl.NumberFormat("he-IL");

// Top courses by activity in the period (room messages + AI questions) as
// horizontal bars: one series, one colour, the value printed beside each bar.
export function CourseActivityBars({
  courses,
}: {
  courses: { id: string; name: string; code: string | null; messages: number; aiRuns: number }[];
}) {
  const rows = courses
    .map((c) => ({ ...c, total: c.messages + c.aiRuns }))
    .filter((c) => c.total > 0)
    .slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-border bg-white p-5 shadow-card">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-bold">קורסים לפי פעילות</h2>
        <p className="text-xs text-muted-foreground">הודעות בחדרים + שאלות לעוזר בתקופה</p>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">אין פעילות בקורסים בתקופה</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-1"
              title={`${c.name}: ${nf.format(c.messages)} הודעות, ${nf.format(c.aiRuns)} שאלות לעוזר`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{c.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {nf.format(c.total)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(2, (c.total / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
