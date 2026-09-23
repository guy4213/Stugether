import { redirect } from "next/navigation";
import { CoursesFilterBar } from "@/components/courses/filter-bar";
import { CourseCard } from "@/components/courses/course-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getCoursesPageData } from "@/lib/courses/queries";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; departmentId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { q, departmentId } = await searchParams;
  const { courses, departments, favoriteIds, roomCounts, institutionId } = await getCoursesPageData(
    user.id,
    { q, departmentId },
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold">קורסים</h1>
        <p className="text-sm text-muted-foreground">מצאו את הקורס המתאים לכם</p>
      </div>

      {!institutionId ? (
        <p className="text-sm text-muted-foreground">
          יש להשלים מוסד לימודים בפרופיל כדי לראות את קטלוג הקורסים.
        </p>
      ) : (
        <>
          <CoursesFilterBar departments={departments} />

          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">לא נמצאו קורסים תואמים.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  activeRoomCount={roomCounts[course.id] ?? 0}
                  isFavorite={favoriteIds.has(course.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
