import Link from "next/link";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/components/ui/live-dot";
import { Pill } from "@/components/ui/pill";
import { RowMenu } from "@/components/dashboard/row-menu";
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

// "הקורסים שלי" card: progress box, students, badge and "כניסה לקורס".
export function MyCourseCard({ course }: { course: DashboardCourse }) {
  const meta = [course.code, course.yearLabel].filter(Boolean).join(" • ");

  return (
    <article className="flex h-full flex-col gap-4 rounded-[20px] border border-border bg-card p-5 shadow-card-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-lg font-extrabold">
            <Link prefetch={false} href={`/courses/${course.id}`} className="hover:text-primary">
              {course.name}
            </Link>
          </h3>
          {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        </div>
        <RowMenu
          orientation="horizontal"
          label={`אפשרויות לקורס ${course.name}`}
          className="border border-border"
          items={[
            { label: "המשך ללמוד", href: course.continueHref },
            { label: "פרטי הקורס", href: `/courses/${course.id}` },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2.5 rounded-[14px] bg-surface-2 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-[13px] font-bold">התקדמות בקורס</span>
            {course.topicsTotal > 0 && (
              <span className="text-xs text-muted-foreground">
                נושאים {course.topicsMastered} מתוך {course.topicsTotal}
              </span>
            )}
          </div>
          <span className="text-2xl font-extrabold text-primary">{course.progress}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`התקדמות ב${course.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={course.progress}
          className="h-1.5 overflow-hidden rounded-full bg-track"
        >
          <div
            className="h-full rounded-full bg-linear-to-l from-[#0d9488] to-primary"
            style={{ width: `${course.progress}%` }}
          />
        </div>
      </div>

      <div className="flex min-h-7 items-center justify-between gap-2">
        <Badge badge={course.badge} completed={course.completed} />
        <span className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {course.studentCount === 1 ? "סטודנט אחד" : `${course.studentCount} סטודנטים`}
          <UsersIcon className="size-4" aria-hidden />
        </span>
      </div>

      <Button
        asChild
        variant="outline-primary"
        size="md"
        className="mt-auto h-10 w-full rounded-full"
      >
        <Link prefetch={false} href={`/courses/${course.id}`}>
          כניסה לקורס
          <ArrowLeftIcon strokeWidth={2.4} />
        </Link>
      </Button>
    </article>
  );
}
