import { redirect } from "next/navigation";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { CourseSearchBox, CoursesFilterBar } from "@/components/courses/filter-bar";
import { CourseCard } from "@/components/courses/course-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getCoursesPageData, parseCourseSort } from "@/lib/courses/queries";

// Course discovery per Discover.dc.html ("גילוי קורסים").
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; departmentId?: string; favorites?: string; sort?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { q, departmentId, favorites, sort } = await searchParams;
  const data = await getCoursesPageData(user.id, {
    q,
    departmentId,
    favorites: favorites === "1",
    sort: parseCourseSort(sort),
  });
  const departmentNameById = new Map(data.departments.map((d) => [d.id, d.name]));
  const filtered = Boolean(q || departmentId || favorites);

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-[22px] px-4 pt-7 pb-10 sm:px-8 xl:px-12"
    >
      <section className="relative flex flex-col gap-8 overflow-hidden rounded-[28px] bg-brand-hero p-6 text-white shadow-banner sm:p-9 lg:min-h-[236px] lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-10">
        <span
          aria-hidden
          className="absolute -top-40 left-[120px] size-80 rounded-full bg-white/8"
        />
        <span
          aria-hidden
          className="absolute -bottom-[70px] -left-10 size-[180px] rotate-[18deg] rounded-[44px] bg-white/7"
        />
        <div className="relative flex max-w-[720px] grow flex-col gap-[18px]">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.6px] sm:text-[40px]">
              מצאו את הקורס המתאים לכם
            </h1>
            <p className="text-base text-white/88">
              חפשו לפי שם או מחלקה, הצטרפו לחדרי לימוד ולמדו יחד.
            </p>
          </div>
          {data.institutionId && <CourseSearchBox />}
        </div>
        {data.institutionId && (
          <dl className="relative grid shrink-0 grid-cols-3 gap-2.5 lg:flex lg:flex-col">
            <HeroStat label="קורסים זמינים" value={data.totals.courses} />
            <HeroStat label="סטודנטים לומדים" value={data.totals.students} />
            <HeroStat label="חדרי לימוד חיים" value={data.totals.liveRooms} live />
          </dl>
        )}
      </section>

      {!data.institutionId ? (
        <div className="rounded-[22px] border-2 border-dashed border-switch-off bg-surface-2 p-8 text-center">
          <p className="text-muted-foreground">
            כדי לראות את קטלוג הקורסים, בחרו מוסד לימודים בפרופיל.
          </p>
          <Link href="/profile" className="mt-2 inline-block font-semibold text-primary">
            להשלמת הפרופיל
          </Link>
        </div>
      ) : (
        <>
          <CoursesFilterBar departments={data.departments} />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {data.courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                departmentName={
                  course.department_id ? (departmentNameById.get(course.department_id) ?? null) : null
                }
                activeRoomCount={data.roomCounts[course.id] ?? 0}
                studentCount={data.studentCounts[course.id] ?? 0}
                isFavorite={data.favoriteIds.has(course.id)}
                popular={data.popularIds.has(course.id)}
              />
            ))}

            {/* Only a super_admin can add catalog courses, so this card resets
                the search instead of offering "הוספת קורס חדש". */}
            <Link
              href="/courses"
              className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-switch-off bg-surface-2 p-6 text-center text-primary-strong"
            >
              <span className="flex size-[60px] items-center justify-center rounded-full bg-brand-diag text-white shadow-glow-blue">
                <PlusIcon className="size-[26px]" strokeWidth={2.4} aria-hidden />
              </span>
              <span className="text-[17px] font-bold text-foreground">
                {data.courses.length === 0
                  ? favorites === "1"
                    ? "עדיין לא סימנתם קורסים כמועדפים"
                    : "לא נמצאו קורסים תואמים"
                  : "לא מצאתם את הקורס?"}
              </span>
              <span className="text-sm font-semibold">
                {filtered ? "ניקוי החיפוש והסינון" : "פנו למנהל המערכת להוספת קורס"}
              </span>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

function HeroStat({ label, value, live = false }: { label: string; value: number; live?: boolean }) {
  return (
    <div className="flex flex-col items-start justify-between gap-1 rounded-[18px] border border-white/22 bg-white/14 px-4 py-3.5 sm:flex-row sm:items-center lg:w-[220px] lg:px-[18px]">
      <dt className="flex items-center gap-2 text-sm text-white/90">
        {live && (
          <span
            aria-hidden
            className="size-2 rounded-full bg-[#6EE7B7] shadow-[0_0_0_4px_rgba(110,231,183,.25)]"
          />
        )}
        {label}
      </dt>
      <dd className="text-[26px] leading-none font-extrabold">{value}</dd>
    </div>
  );
}
