import Link from "next/link";
import { courseTheme } from "@/lib/ui/course-theme";
import { TONE_GRADIENT } from "@/lib/ui/tones";

const SHOWN = 6;

// "פעילות לפי קורס" (client QA 12.11.2026, in place of the department donut):
// how many messages I sent in each course's rooms over the selected range.
// Horizontal bars, longest first; the number sits next to every bar, so the
// value never depends on reading the bar length.
export function CourseActivityChart({
  courses,
  weeks,
}: {
  courses: { id: string; name: string; messages: number }[];
  weeks: number;
}) {
  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        עוד לא שלחת הודעות בחדרי לימוד ב-{weeks} השבועות האחרונים.
      </p>
    );
  }
  const shown = courses.slice(0, SHOWN);
  const max = Math.max(...shown.map((c) => c.messages));
  const total = courses.reduce((s, c) => s + c.messages, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13px] text-muted-foreground">
        {total} הודעות שלך בחדרי הלימוד, לפי קורס ({weeks} שבועות)
      </p>
      <ul className="flex flex-col gap-3">
        {shown.map((c) => {
          const [from, to] = TONE_GRADIENT[courseTheme(c.name, c.id).tone];
          return (
            <li key={c.id}>
              <Link
                href={`/courses/${c.id}`}
                className="flex flex-col gap-1.5 rounded-lg hover:text-primary"
              >
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="line-clamp-2 font-semibold">{c.name}</span>
                  <span className="shrink-0 font-bold tabular-nums">{c.messages}</span>
                </span>
                <span className="h-2.5 overflow-hidden rounded-[5px] bg-track">
                  <span
                    className="block h-full rounded-[5px]"
                    style={{
                      width: `${Math.max(4, (c.messages / max) * 100)}%`,
                      backgroundImage: `linear-gradient(270deg, ${from}, ${to})`,
                    }}
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {courses.length > SHOWN && (
        <p className="text-xs text-muted-foreground">ועוד {courses.length - SHOWN} קורסים</p>
      )}
    </div>
  );
}
