import { createElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AwardIcon,
  BookOpenIcon,
  CheckIcon,
  CircleCheckIcon,
  DoorOpenIcon,
  FlagIcon,
  LockIcon,
  MessageSquareIcon,
  RocketIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { IconTile } from "@/components/ui/icon-tile";
import { ActivityChart } from "@/components/analytics/activity-chart";
import { ShareButton } from "@/components/analytics/share-button";
import { SubjectDonut } from "@/components/analytics/subject-donut";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnalyticsData, parseAnalyticsRange } from "@/lib/analytics/queries";
import { courseTheme } from "@/lib/ui/course-theme";
import { TONE_GRADIENT } from "@/lib/ui/tones";

const ACHIEVEMENTS: { icon: LucideIcon; gradient: string; glow: string }[] = [
  { icon: RocketIcon, gradient: "bg-brand-diag", glow: "shadow-[0_10px_18px_-10px_rgba(37,99,235,.7)]" },
  {
    icon: FlagIcon,
    gradient: "bg-[linear-gradient(135deg,#6d4aff,#2563eb)]",
    glow: "shadow-[0_10px_18px_-10px_rgba(109,74,255,.7)]",
  },
  {
    icon: UsersIcon,
    gradient: "bg-[linear-gradient(135deg,#0d9488,#10b981)]",
    glow: "shadow-[0_10px_18px_-10px_rgba(13,148,136,.7)]",
  },
  {
    icon: AwardIcon,
    gradient: "bg-[linear-gradient(135deg,#f59e0b,#f97316)]",
    glow: "shadow-[0_10px_18px_-10px_rgba(245,158,11,.8)]",
  },
];

// "ההתקדמות שלי" per Progress.dc.html.
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { range } = await searchParams;
  const data = await getAnalyticsData(user.id, parseAnalyticsRange(range));
  const periodLabel = data.range === "semester" ? "בסמסטר" : `ב-${data.weeks} שבועות`;
  const earned = data.achievements.filter((a) => a.earned).length;

  // Sparkline of the last 8 weeks for the messages KPI.
  const spark = data.weekly.slice(-8);
  const sparkMax = Math.max(1, ...spark.map((w) => w.count));
  const sparkPath = spark
    .map((w, i) => {
      const x = 108 - (i / Math.max(1, spark.length - 1)) * 106;
      const y = 32 - (w.count / sparkMax) * 26;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const roomSquares = Math.max(3, Math.min(data.activeRoomsCount, 6));
  const completedShare = data.enrolledCount
    ? (data.completedCourses.length / data.enrolledCount) * 94.2
    : 0;

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-[22px] px-4 pt-7 pb-10 sm:px-8 xl:px-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.5px] sm:text-[38px]">
            ההתקדמות שלי
          </h1>
          <span className="text-[15px] text-muted-foreground">
            מבט על הלמידה שלך {data.range === "semester" ? "בסמסטר האחרון" : `ב-${data.weeks} השבועות האחרונים`}
          </span>
        </div>
        <ShareButton completedCount={data.completedCourses.length} />
      </div>

      {/* KPIs */}
      <section aria-label="מדדים" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative flex h-[132px] flex-col justify-between overflow-hidden rounded-[22px] bg-[linear-gradient(120deg,#2563eb,#0d9488)] px-6 py-[22px] text-white shadow-[0_18px_32px_-18px_rgba(37,99,235,.7)]">
          <span aria-hidden className="absolute -top-[70px] -left-[50px] size-40 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between">
            <span className="text-sm text-white/90">הודעות {periodLabel}</span>
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/20">
              <MessageSquareIcon className="size-5" strokeWidth={2} aria-hidden />
            </span>
          </div>
          <div className="relative flex items-end justify-between">
            <span className="text-[44px] leading-[.9] font-extrabold">{data.messagesSent}</span>
            <svg width="110" height="36" viewBox="0 0 110 36" aria-hidden>
              <path
                d={sparkPath}
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <KpiCard label="חדרי לימוד" icon={DoorOpenIcon} tone="violet" value={data.activeRoomsCount}>
          <span className="flex gap-1" aria-hidden>
            {Array.from({ length: roomSquares }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-[22px] rounded-[7px]",
                  i < data.activeRoomsCount ? "bg-violet" : "bg-violet-soft",
                )}
              />
            ))}
          </span>
        </KpiCard>

        <KpiCard
          label="קורסים שהושלמו"
          icon={CircleCheckIcon}
          tone="blue"
          value={data.completedCourses.length}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="15" fill="none" stroke="#E9EFFE" strokeWidth="6" />
            {completedShare > 0 && (
              <circle
                cx="20"
                cy="20"
                r="15"
                fill="none"
                stroke="#2563EB"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${completedShare} 94.2`}
                transform="rotate(-90 20 20)"
              />
            )}
          </svg>
        </KpiCard>

        <KpiCard
          label="קורסים פעילים"
          icon={BookOpenIcon}
          tone="teal"
          value={data.activeCourses.length}
        >
          <span className="h-2 w-[110px] overflow-hidden rounded bg-track" aria-hidden>
            <span
              className="block h-full rounded bg-[linear-gradient(270deg,#2563eb,#0d9488)]"
              style={{ width: `${data.avgActiveProgress}%` }}
            />
          </span>
        </KpiCard>
      </section>

      {/* Chart + achievements */}
      <section className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
        <div className="flex min-w-0 grow flex-col gap-3 rounded-[22px] border border-border bg-card px-5 py-6 sm:px-[26px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[19px] font-bold">פעילות למידה</h2>
              <span className="text-[13px] text-muted-foreground">הודעות לפי שבוע</span>
            </div>
            <nav
              aria-label="טווח זמן"
              className="flex gap-1 rounded-xl bg-muted p-1"
            >
              <RangeLink href="/analytics" active={data.range === "8w"}>
                8 שבועות
              </RangeLink>
              <RangeLink href="/analytics?range=semester" active={data.range === "semester"}>
                סמסטר
              </RangeLink>
            </nav>
          </div>
          <ActivityChart weekly={data.weekly} />
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 rounded-[22px] border border-border bg-card p-6 xl:w-[420px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[19px] font-bold">הישגים</h2>
            <span className="rounded-full bg-primary-tint px-2.5 py-1 text-xs font-bold text-primary-strong">
              {earned} מתוך {data.achievements.length}
            </span>
          </div>
          <ul className="grid grow grid-cols-2 gap-3">
            {data.achievements.map((a, i) => {
              const meta = ACHIEVEMENTS[i];
              return (
                <li
                  key={a.title}
                  className="flex flex-col items-center gap-2 rounded-[18px] border border-divider bg-surface-2 p-4 text-center"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-14 items-center justify-center rounded-[18px] text-white",
                      a.earned ? cn(meta.gradient, meta.glow) : "bg-track text-muted-foreground",
                    )}
                  >
                    {createElement(a.earned ? meta.icon : LockIcon, {
                      className: "size-[26px]",
                      strokeWidth: 2,
                    })}
                  </span>
                  <span className={cn("text-[15px] font-bold", !a.earned && "text-muted-foreground")}>
                    {a.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.description}
                    {!a.earned && <span className="sr-only"> (טרם הושג)</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Course progress + department */}
      <section className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
        <div className="flex min-w-0 grow flex-col gap-[18px] rounded-[22px] border border-border bg-card px-5 py-6 sm:px-[26px]">
          <h2 className="text-[19px] font-bold">התקדמות לפי קורס</h2>
          {data.courseProgress.length === 0 && (
            <p className="text-sm text-muted-foreground">אין קורסים פעילים כרגע.</p>
          )}
          {data.courseProgress.map((c) => {
            const theme = courseTheme(c.name, c.id);
            const [from, to] = TONE_GRADIENT[theme.tone];
            return (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="flex items-center gap-4 rounded-xl outline-offset-4"
              >
                <IconTile tone={theme.tone}>
                  {createElement(theme.icon, { strokeWidth: 2.2 })}
                </IconTile>
                <div className="flex grow flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold">{c.name}</span>
                    {c.completed ? (
                      <span className="flex items-center gap-[5px] rounded-full bg-success-soft px-2.5 py-1 text-[13px] font-bold text-success-ink">
                        <CheckIcon className="size-[13px]" strokeWidth={3} aria-hidden />
                        הושלם
                      </span>
                    ) : (
                      <span className="text-base font-extrabold">{c.progress}%</span>
                    )}
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`התקדמות ב${c.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={c.progress}
                    className="h-2.5 overflow-hidden rounded-[5px] bg-divider"
                  >
                    <div
                      className="h-full rounded-[5px]"
                      style={{
                        width: `${c.completed ? 100 : c.progress}%`,
                        backgroundImage: c.completed
                          ? "linear-gradient(270deg, #0d9488, #10b981)"
                          : `linear-gradient(270deg, ${from}, ${to})`,
                      }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3.5 rounded-[22px] border border-border bg-card px-5 py-6 sm:px-[26px] xl:w-[520px]">
          <h2 className="text-[19px] font-bold">פילוח לפי מחלקה</h2>
          <SubjectDonut subjects={data.subjects} />
        </div>
      </section>
    </main>
  );
}

function KpiCard({
  label,
  icon,
  tone,
  value,
  children,
}: {
  label: string;
  icon: LucideIcon;
  tone: "violet" | "blue" | "teal";
  value: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[132px] flex-col justify-between rounded-[22px] border border-border bg-card px-6 py-[22px]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <IconTile tone={tone} className="size-10 rounded-xl [&_svg]:size-5">
          {createElement(icon, { strokeWidth: 2 })}
        </IconTile>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-[44px] leading-[.9] font-extrabold">{value}</span>
        {children}
      </div>
    </div>
  );
}

function RangeLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={cn(
        "flex h-8 items-center rounded-[9px] px-3 text-[13px]",
        active
          ? "bg-white font-semibold text-primary-strong shadow-soft"
          : "font-medium text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
