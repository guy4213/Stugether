"use client";

import { createElement, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import { SectionHeader } from "@/components/dashboard/section-header";
import { courseTheme } from "@/lib/ui/course-theme";
import type { DashboardData } from "@/lib/dashboard/queries";

// "ההתקדמות שלי": one slide per unfinished course. The arrows switch courses
// (client QA 11.2026 — the left arrow used to open the course page instead).
export function ProgressCard({
  heroes,
  stats,
}: {
  heroes: DashboardData["heroes"];
  stats: DashboardData["stats"];
}) {
  const [index, setIndex] = useState(0);
  const count = heroes.length;
  const hero = count > 0 ? heroes[Math.min(index, count - 1)] : null;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  return (
    <section aria-labelledby="my-progress" className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        id="my-progress"
        title="ההתקדמות שלי"
        extra={
          count > 1 && (
            <span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
              {Math.min(index, count - 1) + 1} מתוך {count}
            </span>
          )
        }
      />

      <div className="flex flex-1 flex-col gap-4 rounded-[20px] border border-border bg-card p-5 shadow-card-sm">
        {!hero ? (
          <p className="my-auto text-center text-sm text-muted-foreground">
            {stats.activeCourses ? "סיימת את כל הנושאים בקורסים שלך 🎉" : "עוד לא נרשמת לקורסים."}
          </p>
        ) : (
          <>
            <div className="flex items-start gap-2">
              {count > 1 && (
                <ArrowButton label="לקורס הקודם" onClick={() => go(-1)}>
                  <ChevronRightIcon className="size-4" aria-hidden />
                </ArrowButton>
              )}
              <div className="flex min-w-0 grow items-start gap-3.5">
                <ProgressRing
                  value={hero.progress}
                  size={84}
                  stroke={9}
                  from="#2563eb"
                  to="#1d4ed8"
                  label={`${hero.progress}% מהקורס`}
                >
                  <span className="text-xl font-extrabold">{hero.progress}%</span>
                </ProgressRing>
                <div className="flex min-w-0 grow flex-col gap-1 pt-3">
                  <span className="flex items-center gap-2">
                    <IconTile
                      tone={courseTheme(hero.name, hero.courseId).tone}
                      className="size-8 shrink-0 rounded-[10px] [&_svg]:size-4"
                    >
                      {createElement(courseTheme(hero.name, hero.courseId).icon, {
                        strokeWidth: 2.2,
                      })}
                    </IconTile>
                    <Link
                      href={`/courses/${hero.courseId}`}
                      className="line-clamp-2 font-bold hover:text-primary"
                    >
                      {hero.name}
                    </Link>
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {hero.currentTopic ? `נושא נוכחי: ${hero.currentTopic}` : "אין נושא פתוח"}
                  </span>
                </div>
              </div>
              {count > 1 && (
                <ArrowButton label="לקורס הבא" onClick={() => go(1)}>
                  <ChevronLeftIcon className="size-4" aria-hidden />
                </ArrowButton>
              )}
            </div>

            <dl className="grid grid-cols-3 gap-2 text-center">
              <Stat label="ממוצע התקדמות בכל הקורסים" value={`${stats.avgProgress}%`} />
              <Stat label="שותפים" value={stats.partners} />
              <Stat label="נושאים" value={`${hero.mastered}/${hero.total}`} />
            </dl>

            <SegmentedBar
              total={hero.total}
              filled={hero.mastered}
              label={`${hero.mastered} מתוך ${hero.total} נושאים`}
            />

            {count > 1 && (
              <div className="flex justify-center gap-1.5" aria-hidden>
                {heroes.map((h, i) => (
                  <span
                    key={h.courseId}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === Math.min(index, count - 1) ? "w-5 bg-primary" : "w-1.5 bg-switch-off",
                    )}
                  />
                ))}
              </div>
            )}

            <Button asChild variant="brand" size="md" className="mt-auto w-full">
              <Link href={hero.continueHref}>
                המשך ללמוד
                <ArrowLeftIcon strokeWidth={2.4} />
              </Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function ArrowButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="mt-6 flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-primary transition-colors hover:bg-primary-soft"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-0.5 rounded-[14px] bg-surface-2 px-1.5 py-2.5">
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd className="text-lg font-extrabold">{value}</dd>
    </div>
  );
}
