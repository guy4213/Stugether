import Link from "next/link";
import { UsersIcon, MessageSquareIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/courses/favorite-button";
import { CourseCover } from "@/components/courses/course-cover";
import type { Course } from "@/lib/repositories/catalog";

export function CourseCard({
  course,
  departmentName,
  activeRoomCount,
  studentCount,
  isFavorite,
  badge,
}: {
  course: Course;
  departmentName: string | null;
  activeRoomCount: number;
  studentCount: number;
  isFavorite: boolean;
  badge: "popular" | "new" | null;
}) {
  return (
    <Card className="group relative gap-0 overflow-hidden border-0 py-0 shadow-sm ring-0 transition-shadow hover:shadow-md">
      <div className="relative">
        <CourseCover
          seed={course.id}
          label={`${course.name} ${course.code ?? ""}`}
          className="h-36"
          iconClassName="size-14"
        />
        <div className="absolute end-3 top-3">
          <FavoriteButton courseId={course.id} initialIsFavorite={isFavorite} />
        </div>
        {badge && (
          <span className="absolute start-0 top-3 rounded-e-full bg-linear-to-l from-secondary to-[oklch(0.8_0.12_165)] px-3 py-1 text-xs font-bold text-secondary-foreground">
            {badge === "popular" ? "פופולרי" : "חדש"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-base font-semibold">{course.name}</p>
          <p className="text-sm text-muted-foreground">
            {[course.code, departmentName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <UsersIcon className="size-4" />
            {studentCount} סטודנטים
          </span>
          <span className="flex items-center gap-1.5">
            <MessageSquareIcon className="size-4" />
            {activeRoomCount} חדרי לימוד
          </span>
        </div>
        <Button
          asChild
          variant="secondary"
          className="mt-auto h-10 w-full rounded-full bg-primary/10 text-primary hover:bg-primary/15"
        >
          <Link href={`/courses/${course.id}`}>צפייה בקורס</Link>
        </Button>
      </div>
    </Card>
  );
}
