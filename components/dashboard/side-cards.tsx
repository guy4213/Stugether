import { createElement } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ChevronLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import { SectionHeader } from "@/components/dashboard/section-header";
import { courseTheme } from "@/lib/ui/course-theme";
import type { DashboardData } from "@/lib/dashboard/queries";

// Side column of the dashboard: my progress in the course to continue, and
// general numbers.

export function ProgressCard({
  hero,
  stats,
}: {
  hero: DashboardData["hero"];
  stats: DashboardData["stats"];
}) {
  return (
    <section aria-labelledby="my-progress" className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader id="my-progress" title="ההתקדמות שלי" />

      <div className="flex flex-1 flex-col gap-4 rounded-[20px] border border-border bg-card p-5 shadow-card-sm">
        {!hero ? (
          <p className="my-auto text-center text-sm text-muted-foreground">
            {stats.activeCourses ? "סיימת את כל הנושאים בקורסים שלך 🎉" : "עוד לא נרשמת לקורסים."}
          </p>
        ) : (
          <>
            <div className="flex items-start gap-3.5">
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
                    className="size-8 rounded-[10px] [&_svg]:size-4"
                  >
                    {createElement(courseTheme(hero.name, hero.courseId).icon, {
                      strokeWidth: 2.2,
                    })}
                  </IconTile>
                  <span className="truncate font-bold">{hero.name}</span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {hero.currentTopic ? `נושא נוכחי: ${hero.currentTopic}` : "אין נושא פתוח"}
                </span>
              </div>
              <Link
                href={`/courses/${hero.courseId}`}
                aria-label={`לדף הקורס ${hero.name}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-primary hover:bg-primary-soft"
              >
                <ChevronLeftIcon className="size-4" aria-hidden />
              </Link>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col-reverse justify-end gap-0.5 rounded-[14px] bg-surface-2 px-1.5 py-2.5">
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd className="text-lg font-extrabold">{value}</dd>
    </div>
  );
}

export function InfoTiles({
  stats,
  pendingInvitations,
}: {
  stats: DashboardData["stats"];
  pendingInvitations: number;
}) {
  // RTL: the first tile is the top-right one.
  const tiles = [
    { label: "חדרים פעילים", value: stats.activeRooms, href: "#my-rooms" },
    { label: "קורסים פעילים", value: stats.activeCourses, href: "/courses" },
    { label: "הזמנות ממתינות", value: pendingInvitations, href: "/notifications" },
    { label: "שותפים ללמידה", value: stats.partners, href: "/students" },
  ];

  return (
    <section aria-labelledby="general-info" className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader id="general-info" title="מידע כללי" />
      <ul className="grid flex-1 grid-cols-2 gap-3">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="flex h-full min-h-[104px] flex-col items-center justify-center gap-1 rounded-[18px] border border-border bg-card p-4 text-center shadow-card-sm transition-colors hover:border-primary-line"
            >
              <span className="text-[32px] leading-none font-extrabold text-primary">
                {t.value}
              </span>
              <span className="text-[13px] text-muted-foreground">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
