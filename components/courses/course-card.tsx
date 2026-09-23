import Link from "next/link";
import { UsersIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/courses/favorite-button";
import type { Course } from "@/lib/repositories/catalog";

export function CourseCard({
  course,
  activeRoomCount,
  isFavorite,
}: {
  course: Course;
  activeRoomCount: number;
  isFavorite: boolean;
}) {
  return (
    <Card className="relative">
      <div className="absolute end-3 top-3">
        <FavoriteButton courseId={course.id} initialIsFavorite={isFavorite} />
      </div>
      <CardContent className="space-y-2">
        <div>
          {course.code && <p className="text-xs text-muted-foreground">{course.code}</p>}
          <p className="font-medium">{course.name}</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UsersIcon className="size-3.5" />
          {activeRoomCount} חדרי לימוד פעילים
        </p>
        <Button asChild size="sm" className="w-full">
          <Link href={`/courses/${course.id}`}>צפייה בקורס</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
