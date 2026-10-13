import { createElement } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  MailIcon,
  MessageSquareIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SegmentedBar } from "@/components/ui/segmented-bar";
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
    <section
      aria-labelledby="my-progress"
      className="flex flex-col gap-4 rounded-[24px] border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <h2 id="my-progress" className="text-lg font-extrabold">
          ההתקדמות שלי
        </h2>
        <Link href="/analytics" className="text-sm font-semibold text-primary">
          לכל הקורסים
        </Link>
      </div>

      {!hero ? (
        <p className="text-sm text-muted-foreground">
          {stats.activeCourses ? "סיימת את כל הנושאים בקורסים שלך 🎉" : "עוד לא נרשמת לקורסים."}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <ProgressRing
              value={hero.progress}
              size={104}
              stroke={10}
              label={`${hero.progress}% מהקורס`}
            >
              <span className="flex flex-col items-center leading-none">
                <span className="text-2xl font-extrabold">{hero.progress}%</span>
                <span className="mt-1 text-[11px] text-muted-foreground">הושלם</span>
              </span>
            </ProgressRing>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-diag text-white"
                >
                  {createElement(courseTheme(hero.name, hero.courseId).icon, {
                    className: "size-4",
                  })}
                </span>
                <span className="truncate font-bold">{hero.name}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {hero.currentTopic ? `נושא נוכחי: ${hero.currentTopic}` : "אין נושא פתוח"}
              </span>
            </div>
          </div>
          <SegmentedBar
            total={hero.total}
            filled={hero.mastered}
            label={`${hero.mastered} מתוך ${hero.total} נושאים`}
          />
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="נושאים" value={`${hero.mastered}/${hero.total}`} />
            <Stat label="שותפים" value={stats.partners} />
            <Stat label="ממוצע קורסים" value={`${stats.avgProgress}%`} />
          </dl>
          <Button asChild variant="brand" size="md" className="rounded-[14px]">
            <Link href={hero.continueHref}>
              המשך ללמוד
              <ArrowLeftIcon strokeWidth={2.4} />
            </Link>
          </Button>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col-reverse rounded-[14px] bg-muted px-2 py-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
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
  const tiles: { label: string; value: number; icon: LucideIcon; tone: string; href: string }[] = [
    {
      label: "קורסים פעילים",
      value: stats.activeCourses,
      icon: BookOpenIcon,
      tone: "bg-primary-soft text-primary",
      href: "/analytics",
    },
    {
      label: "חדרים פעילים",
      value: stats.activeRooms,
      icon: MessageSquareIcon,
      tone: "bg-success-soft text-success-ink",
      href: "#my-rooms",
    },
    {
      label: "שותפים ללמידה",
      value: stats.partners,
      icon: UsersIcon,
      tone: "bg-[#f1ecff] text-[#7c3aed]",
      href: "/students",
    },
    {
      label: "הזמנות ממתינות",
      value: pendingInvitations,
      icon: MailIcon,
      tone: "bg-warning-soft text-warning-ink",
      href: "/notifications",
    },
  ];

  return (
    <section
      aria-labelledby="general-info"
      className="flex flex-col gap-3 rounded-[24px] border border-border bg-card p-5"
    >
      <h2 id="general-info" className="text-lg font-extrabold">
        מידע כללי
      </h2>
      <ul className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="flex items-center gap-2.5 rounded-[16px] border border-border p-3 hover:border-primary-line"
            >
              <span
                aria-hidden
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${t.tone}`}
              >
                <t.icon className="size-5" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-xl font-extrabold">{t.value}</span>
                <span className="text-[11px] text-muted-foreground">{t.label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
