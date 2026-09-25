import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { CourseCover } from "@/components/courses/course-cover";
import { FavoriteButton } from "@/components/courses/favorite-button";
import { AvatarStack } from "@/components/ui/avatar-stack";
import type { Course } from "@/lib/repositories/catalog";

function FlameIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden>
      <path d="M12 2.5c.9 3.3 5.5 5.4 5.5 10.4a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4 2.4-5.1.2 2 1.1 3.2 2.5 3.6C10.8 8.6 11.1 5.2 12 2.5z" />
    </svg>
  );
}

// Catalog card (Discover.dc.html). Rosters of courses the student isn't in
// are hidden by RLS, so the avatar stack is anonymous tinted circles sized
// from the aggregate count — exactly how the mockup draws it.
export function CourseCard({
  course,
  departmentName,
  activeRoomCount,
  studentCount,
  isFavorite,
  popular,
}: {
  course: Course;
  departmentName: string | null;
  activeRoomCount: number;
  studentCount: number;
  isFavorite: boolean;
  popular: boolean;
}) {
  const people = Array.from({ length: Math.min(studentCount, 3) }, (_, i) => ({
    id: `${course.id}-${i}`,
    name: "",
  }));

  return (
    <article className="flex flex-col overflow-hidden rounded-[22px] border border-border bg-card shadow-card-sm">
      <CourseCover seed={course.id} label={`${course.name} ${course.code ?? ""}`} className="h-[140px]">
        {popular && (
          <span className="absolute top-3.5 right-3.5 flex h-7 items-center gap-[5px] rounded-full bg-white px-2.5 text-xs font-bold text-[#B45309]">
            <FlameIcon />
            פופולרי
          </span>
        )}
        <FavoriteButton
          courseId={course.id}
          initialIsFavorite={isFavorite}
          className="absolute top-3 left-3"
        />
      </CourseCover>
      <div className="flex grow flex-col gap-3.5 px-5 pt-[18px] pb-5">
        <div className="flex flex-col gap-[3px]">
          <h3 className="text-[19px] font-bold">{course.name}</h3>
          <span className="text-[13px] text-muted-foreground">
            {[course.code, departmentName].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
            <AvatarStack people={people} max={3} total={studentCount} size="sm" />
            {studentCount === 1 ? "סטודנט/ית 1" : `${studentCount} סטודנטים`}
          </span>
          {activeRoomCount > 0 ? (
            <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-[5px] text-xs font-semibold text-success-ink">
              <span className="size-[7px] rounded-full bg-success" aria-hidden />
              {activeRoomCount === 1 ? "חדר חי" : `${activeRoomCount} חדרים חיים`}
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2.5 py-[5px] text-xs font-semibold text-muted-foreground">
              אין חדר פעיל
            </span>
          )}
        </div>
        <Link
          href={`/courses/${course.id}`}
          className="mt-auto flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-soft text-[15px] font-semibold text-primary-strong hover:bg-primary-tint"
        >
          צפייה בקורס
          <ArrowLeftIcon className="size-4" strokeWidth={2.2} aria-hidden />
        </Link>
      </div>
    </article>
  );
}
