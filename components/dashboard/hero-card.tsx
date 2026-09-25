import { createElement } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CompassIcon,
  MessageSquareIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { LiveDot } from "@/components/ui/live-dot";
import { JoinRoomButton } from "@/components/rooms/join-room-button";
import { TopicTree } from "@/components/dashboard/topic-tree";
import { courseTheme } from "@/lib/ui/course-theme";
import type { DashboardData } from "@/lib/dashboard/queries";

type Hero = NonNullable<DashboardData["hero"]>;
type Stats = DashboardData["stats"];

// Hybrid.dc.html "HERO": course + CTA · current topic · progress ring · topic
// map, over a 4-column stats strip.
export function HeroCard({ hero, stats }: { hero: Hero | null; stats: Stats }) {
  return (
    <section
      aria-label="המשך למידה"
      className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-hero"
    >
      {hero ? <HeroBody hero={hero} /> : <HeroEmpty />}
      <StatsStrip stats={stats} />
    </section>
  );
}

function HeroEmpty() {
  return (
    <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between xl:px-8 xl:py-7">
      <div className="flex items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-[20px] bg-brand-diag text-white shadow-glow-blue">
          <CompassIcon className="size-[30px]" strokeWidth={2.2} aria-hidden />
        </span>
        <div>
          <h2 className="text-2xl font-extrabold tracking-[-0.4px]">אין קורס בתהליך</h2>
          <p className="text-sm font-medium text-muted-foreground">
            הירשמו לקורס כדי להתחיל ללמוד עם שותפים
          </p>
        </div>
      </div>
      <Button asChild variant="brand" size="cta" className="px-8">
        <Link href="/courses">
          גלו קורסים
          <ArrowLeftIcon strokeWidth={2.4} />
        </Link>
      </Button>
    </div>
  );
}

function HeroBody({ hero }: { hero: Hero }) {
  const theme = courseTheme(hero.name, hero.courseId);
  const learning = hero.availableNow.length;

  return (
    <div className="flex flex-col gap-6 p-6 md:flex-row md:flex-wrap md:items-center xl:h-[206px] xl:flex-nowrap xl:gap-9 xl:px-8 xl:py-7">
      {/* course + CTA */}
      <div className="flex w-full shrink-0 flex-col gap-5 md:w-[300px]">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-[20px] bg-brand-diag text-white shadow-glow-blue"
          >
            {createElement(theme.icon, { className: "size-[30px]", strokeWidth: 2.2 })}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="truncate text-[30px] leading-[1.1] font-extrabold tracking-[-0.4px]">
              {hero.name}
            </h2>
            <span className="truncate text-sm font-medium text-muted-foreground">
              {[hero.code, hero.currentTopic].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
        <Button asChild variant="brand" size="cta" className="rounded-2xl">
          <Link href={hero.continueHref}>
            המשך ללמוד
            <ArrowLeftIcon strokeWidth={2.4} />
          </Link>
        </Button>
      </div>

      {/* current topic */}
      <div className="flex min-w-0 grow flex-col gap-3.5 md:basis-80 xl:border-s xl:border-divider xl:ps-9">
        <span className="text-[13px] font-medium text-muted-foreground">נושא נוכחי</span>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[22px] font-bold">
            {hero.currentTopic ?? (hero.total ? "כל הנושאים נשלטו" : "טרם הוגדרו נושאים")}
          </span>
          {hero.total > 0 && (
            <span className="shrink-0 text-sm font-medium text-muted-foreground">
              {hero.currentIndex ? `נושא ${hero.currentIndex}/${hero.total}` : `${hero.total} נושאים`}
            </span>
          )}
        </div>
        <SegmentedBar
          total={hero.total}
          filled={hero.mastered}
          label={`${hero.mastered} מתוך ${hero.total} נושאים`}
        />
        <div className="flex items-center gap-3 pt-1">
          {learning > 0 ? (
            <>
              <AvatarStack people={hero.availableNow} size="lg" max={3} showInitials />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <LiveDot />
                {learning === 1 ? "לומד/ת אחד/ת עכשיו" : `${learning} לומדים עכשיו`}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">אף אחד לא פנוי כרגע בקורס</span>
          )}
          {hero.myRoomId ? (
            <Link
              href={`/rooms/${hero.myRoomId}`}
              className="ms-auto text-sm font-semibold text-primary hover:text-primary-strong"
            >
              כניסה לחדר
            </Link>
          ) : hero.openRoomId ? (
            <JoinRoomButton
              roomId={hero.openRoomId}
              variant="link"
              className="ms-auto h-auto p-0 text-sm font-semibold"
            >
              הצטרפות לחדר
            </JoinRoomButton>
          ) : (
            <Link
              href={`/courses/${hero.courseId}`}
              className="ms-auto text-sm font-semibold text-primary hover:text-primary-strong"
            >
              פתיחת חדר
            </Link>
          )}
        </div>
      </div>

      {/* ring */}
      <ProgressRing value={hero.progress} size={150} stroke={14} className="hidden md:block" label={`${hero.progress}% מהקורס`}>
        <span className="text-[40px] leading-none font-extrabold tracking-[-1px]">
          {hero.progress}%
        </span>
        <span className="text-xs font-medium text-muted-foreground">מהקורס</span>
      </ProgressRing>

      {/* topic map */}
      {hero.total > 0 && (
        <div className="hidden xl:block">
          <TopicTree topics={hero.topics} mastered={hero.mastered} total={hero.total} />
        </div>
      )}
    </div>
  );
}

function StatsStrip({ stats }: { stats: Stats }) {
  const barColors = ["#B5EAD9", "#7FD9BF", "#7FD9BF", "#14B8A6", "#0D9488"];
  const bars = stats.courseBars.length ? stats.courseBars : [0];
  const ringDash = (stats.avgProgress / 100) * 88;

  return (
    <div className="grid grid-cols-2 border-t border-divider bg-surface-3 lg:h-24 lg:grid-cols-4">
      <StatCell
        icon={<BookOpenIcon />}
        tone="bg-success-soft text-secondary"
        value={stats.activeCourses}
        label="קורסים פעילים"
      >
        <span className="flex h-7 items-end gap-[3px]" aria-hidden>
          {bars.map((p, i) => (
            <span
              key={i}
              className="w-1.5 rounded-[2px]"
              style={{
                height: `${Math.max(12, Math.round((p / 100) * 28))}px`,
                background: barColors[i % barColors.length],
              }}
            />
          ))}
        </span>
      </StatCell>
      <StatCell
        icon={<MessageSquareIcon />}
        tone="bg-primary-tint text-primary"
        value={stats.activeRooms}
        label="חדרים פעילים"
      >
        {stats.liveRooms > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-ink">
            <LiveDot className="size-[7px]" />
            LIVE
          </span>
        )}
      </StatCell>
      <StatCell
        icon={<UsersIcon />}
        tone="bg-violet-soft text-violet"
        value={stats.partners}
        label="שותפים ללמידה"
      >
        <AvatarStack
          people={stats.partnerPeople}
          max={3}
          total={stats.partners}
          size="sm"
          borderClassName="border-surface-3"
        />
      </StatCell>
      <StatCell
        icon={<TargetIcon />}
        tone="bg-warning-soft text-[#D97706]"
        value={`${stats.avgProgress}%`}
        label="התקדמות ממוצעת"
        last
      >
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="14" fill="none" stroke="#FDEBC8" strokeWidth="5" />
          {stats.avgProgress > 0 && (
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${ringDash} 88`}
              transform="rotate(-90 18 18)"
            />
          )}
        </svg>
      </StatCell>
    </div>
  );
}

function StatCell({
  icon,
  tone,
  value,
  label,
  children,
  last = false,
}: {
  icon: React.ReactNode;
  tone: string;
  value: number | string;
  label: string;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3.5 px-5 py-4 xl:px-8 ${last ? "" : "lg:border-e lg:border-divider"}`}
    >
      <span
        aria-hidden
        className={`flex size-[46px] shrink-0 items-center justify-center rounded-[14px] [&_svg]:size-[22px] ${tone}`}
      >
        {icon}
      </span>
      <div className="flex grow flex-col">
        <span className="text-[28px] leading-none font-extrabold">{value}</span>
        <span className="text-[13px] text-muted-foreground">{label}</span>
      </div>
      <span className="hidden sm:block">{children}</span>
    </div>
  );
}
