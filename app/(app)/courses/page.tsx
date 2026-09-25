import { redirect } from "next/navigation";
import Link from "next/link";
import { CoursesFilterBar } from "@/components/courses/filter-bar";
import { CourseCard } from "@/components/courses/course-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getCoursesPageData } from "@/lib/courses/queries";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; departmentId?: string; favorites?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { q, departmentId, favorites } = await searchParams;
  const { courses, departments, favoriteIds, roomCounts, studentCounts, institutionId } =
    await getCoursesPageData(user.id, { q, departmentId, favorites: favorites === "1" });

  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));

  // Badges from real data: the two busiest courses are "popular"; courses
  // nobody has joined yet are "new".
  const activity = (id: string) => (studentCounts[id] ?? 0) + (roomCounts[id] ?? 0) * 2;
  const popularIds = new Set(
    [...courses]
      .filter((c) => activity(c.id) > 0)
      .sort((a, b) => activity(b.id) - activity(a.id))
      .slice(0, 2)
      .map((c) => c.id),
  );

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">מצאו את הקורס המתאים לכם</h1>
        <p className="mt-1 text-muted-foreground">
          חפשו קורסים לפי שם או מחלקה, הצטרפו לחדרי לימוד ולמדו יחד.
        </p>
      </div>

      {!institutionId ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            כדי לראות את קטלוג הקורסים, בחרו מוסד לימודים בפרופיל.
          </p>
          <Link
            href="/profile"
            className="mt-2 inline-block font-medium text-primary hover:underline"
          >
            להשלמת הפרופיל
          </Link>
        </div>
      ) : (
        <>
          <CoursesFilterBar departments={departments} />

          {courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
              {favorites === "1" ? "עדיין לא סימנתם קורסים כמועדפים." : "לא נמצאו קורסים תואמים."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  departmentName={
                    course.department_id
                      ? (departmentNameById.get(course.department_id) ?? null)
                      : null
                  }
                  activeRoomCount={roomCounts[course.id] ?? 0}
                  studentCount={studentCounts[course.id] ?? 0}
                  isFavorite={favoriteIds.has(course.id)}
                  badge={
                    popularIds.has(course.id)
                      ? "popular"
                      : (studentCounts[course.id] ?? 0) === 0
                        ? "new"
                        : null
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
