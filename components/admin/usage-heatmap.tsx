import { cn } from "cn";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const WEEKDAYS_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

// Sequential, one hue (light -> dark). Level 0 = no activity.
const LEVELS = ["bg-muted", "bg-primary/15", "bg-primary/35", "bg-primary/60", "bg-primary"];

function level(n: number, max: number): number {
  if (n <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((n / max) * 4)));
}

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

// "מתי לומדים": actions (room messages, private messages, AI questions) per
// weekday x hour, Israel time. Hours run along the reading direction (RTL:
// midnight at the right). Every cell has a tooltip with the exact count.
export function UsageHeatmap({
  cells,
  days,
}: {
  cells: { dow: number; hour: number; n: number }[];
  days: number;
}) {
  const grid = WEEKDAYS.map(() => Array<number>(24).fill(0));
  for (const c of cells) grid[c.dow][c.hour] = c.n;
  const max = Math.max(0, ...cells.map((c) => c.n));
  const peak = cells.reduce<(typeof cells)[number] | null>(
    (best, c) => (best === null || c.n > best.n ? c : best),
    null,
  );

  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-border bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">מתי לומדים</h2>
        <span className="text-sm text-muted-foreground">
          {peak
            ? `שעת השיא: יום ${WEEKDAYS[peak.dow]} ${hourLabel(peak.hour)} (${peak.n} פעולות)`
            : `אין פעילות ב-${days} הימים האחרונים`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        הודעות בחדרים, הודעות פרטיות ושאלות לעוזר, לפי שעון ישראל
      </p>

      <div className="overflow-x-auto">
        <div
          role="table"
          aria-label="פעילות לפי יום ושעה"
          className="grid min-w-[560px] gap-[3px]"
          style={{ gridTemplateColumns: "3rem repeat(24, minmax(0, 1fr))" }}
        >
          <div role="row" className="contents">
            <span role="columnheader" />
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                role="columnheader"
                className="text-center text-[11px] text-muted-foreground tabular-nums"
              >
                {h % 3 === 0 ? h : ""}
              </span>
            ))}
          </div>
          {grid.map((hours, dow) => (
            <div key={dow} role="row" className="contents">
              <span
                role="rowheader"
                className="flex items-center text-xs font-medium text-ink-2"
                title={`יום ${WEEKDAYS[dow]}`}
              >
                {WEEKDAYS_SHORT[dow]}
              </span>
              {hours.map((n, h) => (
                <span
                  key={h}
                  role="cell"
                  title={`יום ${WEEKDAYS[dow]}, ${hourLabel(h)}–${hourLabel((h + 1) % 24)}: ${n} פעולות`}
                  aria-label={`יום ${WEEKDAYS[dow]} ${hourLabel(h)}: ${n}`}
                  className={cn(
                    "aspect-square rounded-[4px] transition-[outline] hover:outline-2 hover:outline-ink-2",
                    LEVELS[level(n, max)],
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 self-end text-xs text-muted-foreground">
        <span>פחות</span>
        {LEVELS.map((cls) => (
          <span key={cls} className={cn("size-3 rounded-[3px]", cls)} aria-hidden />
        ))}
        <span>יותר</span>
      </div>
    </section>
  );
}
