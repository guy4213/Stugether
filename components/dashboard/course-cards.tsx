import { createElement } from "react";
import Link from "next/link";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { IconTile } from "@/components/ui/icon-tile";
import { LiveDot } from "@/components/ui/live-dot";
import { Pill } from "@/components/ui/pill";
import { ProgressRing } from "@/components/ui/progress-ring";
import { QuickEnrollButton } from "@/components/courses/quick-enroll-button";
import { courseTheme } from "@/lib/ui/course-theme";
import { TONE_GRADIENT, TONE_SOLID, type Tone } from "@/lib/ui/tones";
import type { CourseBadge, DashboardCourse } from "@/lib/dashboard/queries";

function Badge({ badge, completed }: { badge: CourseBadge; completed: boolean }) {
  if (completed) return <Pill tone="success">הושלם</Pill>;
  if (!badge) return null;
  if (badge.kind === "live")
    return (
      <Pill tone="success" className="py-[5px]">
        <LiveDot className="size-[7px]" />
        חדר פעיל
      </Pill>
    );
  if (badge.kind === "test")
    return (
      <Pill tone="warning" className="py-[5px]">
        מבחן קרוב
      </Pill>
    );
  return (
    <Pill tone="success" className="py-[5px]">
      {badge.count} לומדים
    </Pill>
  );
}

// "הקורסים שלי" card (Hybrid.dc.html). The first card is highlighted with a
// gradient top bar and a solid "המשך" button.
export function MyCourseCard({
  course,
  highlight,
}: {
  course: DashboardCourse;
  highlight: boolean;
}) {
  const theme = courseTheme(course.name, course.id);
  const [from, to] = TONE_GRADIENT[theme.tone];

  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-[20px] bg-card p-[22px]",
        highlight
          ? "border-[1.5px] border-primary-line shadow-highlight"
          : "border border-border",
      )}
    >
      {highlight && <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand" />}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile tone={theme.tone}>
            {createElement(theme.icon, { strokeWidth: 2.2 })}
          </IconTile>
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate text-lg font-bold">{course.name}</h3>
            {course.code && <span className="text-[13px] text-muted-foreground">{course.code}</span>}
          </div>
        </div>
        <Badge badge={course.badge} completed={course.completed} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[22px] font-extrabold">{course.progress}%</span>
          <AvatarStack people={course.people} max={3} />
        </div>
        <div
          role="progressbar"
          aria-label={`התקדמות ב${course.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={course.progress}
          className="h-2 overflow-hidden rounded-full bg-divider"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${course.progress}%`,
              backgroundImage: `linear-gradient(90deg, ${from}, ${to})`,
            }}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          asChild
          variant={highlight ? "solid" : "outline-primary"}
          size="md"
          className="grow"
        >
          <Link href={course.continueHref}>המשך</Link>
        </Button>
        <Button asChild variant="quiet" size="md" className="grow">
          <Link href={`/courses/${course.id}`}>פרטי הקורס</Link>
        </Button>
      </div>
    </article>
  );
}

const MATCH_INK: Partial<Record<Tone, string>> = {
  teal: "text-success-ink",
  success: "text-success-ink",
  violet: "text-violet-ink",
};
const MATCH_TRACK: Record<Tone, string> = {
  blue: "#E9EFFE",
  teal: "#E7F8F3",
  success: "#E7F8F3",
  warning: "#FFF4DE",
  violet: "#F0EBFF",
  rose: "#FDE2E4",
  sky: "#E0F2FE",
  neutral: "#EEF2F8",
};

// "לגלות קורסים חדשים" recommendation card.
export function RecommendationCard({
  course,
}: {
  course: { id: string; name: string; match: number; students: number };
}) {
  const theme = courseTheme(course.name, course.id);
  const solid = theme.tone === "teal" ? "#10B981" : TONE_SOLID[theme.tone];

  return (
    <article className="flex items-center gap-4 rounded-[20px] border border-border bg-card p-5">
      <ProgressRing
        value={course.match}
        size={64}
        stroke={6}
        from={solid}
        to={solid}
        track={MATCH_TRACK[theme.tone]}
      >
        <span style={{ color: theme.tone === "teal" ? "#0D9488" : solid }}>
          {createElement(theme.icon, { className: "size-6", strokeWidth: 2 })}
        </span>
      </ProgressRing>
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <h3 className="truncate text-[17px] font-bold">
          <Link href={`/courses/${course.id}`} className="hover:text-primary">
            {course.name}
          </Link>
        </h3>
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className={cn("font-bold text-primary-strong", MATCH_INK[theme.tone])}>
            {course.match}% התאמה
          </span>
          ·<span>{course.students} לומדים</span>
        </div>
      </div>
      <QuickEnrollButton courseId={course.id} courseName={course.name} />
    </article>
  );
}
