import { redirect } from "next/navigation";
import Link from "next/link";
import { StudentCard } from "@/components/students/student-card";
import { StudentFilters } from "@/components/students/student-filters";
import { Pagination } from "@/components/ui/pagination";
import { getCurrentUser } from "@/lib/auth/session";
import { getStudentsPageData } from "@/lib/students/queries";
import { parseCoursePage } from "@/lib/courses/queries";

// Student directory (Change Request 13.10.2026): every student on the
// platform, best match first.
export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    institutionId?: string;
    departmentId?: string;
    year?: string;
    courseId?: string;
    online?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const year = Number.parseInt(params.year ?? "", 10);
  const data = await getStudentsPageData(user.id, {
    q: params.q,
    institutionId: params.institutionId,
    departmentId: params.departmentId,
    year: Number.isFinite(year) ? year : undefined,
    courseId: params.courseId,
    online: params.online === "1",
    page: parseCoursePage(params.page),
  });
  // Page links keep every filter; ?page is set by the link itself.
  const keep = { ...params, page: undefined };

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 pt-7 pb-10 sm:px-8 xl:px-12"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.5px]">סטודנטים</h1>
          <p className="text-muted-foreground">
            מצאו שותפים ללמידה. הסטודנטים ממוינים לפי אחוז ההתאמה אליכם.
          </p>
        </div>
        <dl className="flex gap-2.5">
          <div className="rounded-[14px] border border-border bg-card px-4 py-2.5">
            <dt className="text-xs text-muted-foreground">סטודנטים</dt>
            <dd className="text-xl font-extrabold">{data.totals.all}</dd>
          </div>
          <div className="rounded-[14px] border border-border bg-card px-4 py-2.5">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              מחוברים עכשיו
            </dt>
            <dd className="text-xl font-extrabold">{data.totals.online}</dd>
          </div>
        </dl>
      </header>

      {!data.hasProfile && (
        <p className="rounded-[18px] bg-primary-soft px-5 py-3.5 text-sm text-primary-strong">
          השלימו מוסד, מחלקה, שנה ותחביבים{" "}
          <Link href="/profile" className="font-bold underline">
            בפרופיל
          </Link>{" "}
          כדי לקבל אחוזי התאמה מדויקים.
        </p>
      )}

      <StudentFilters
        institutions={data.options.institutions}
        departments={data.options.departments}
        myCourses={data.options.myCourses}
      />

      {data.students.length === 0 ? (
        <p className="rounded-[22px] border-2 border-dashed border-switch-off bg-surface-2 p-8 text-center text-muted-foreground">
          לא נמצאו סטודנטים תואמים.{" "}
          <Link href="/students" className="font-semibold text-primary">
            ניקוי הסינון
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.students.map((s) => (
            <StudentCard key={s.profile.id} student={s} />
          ))}
        </div>
      )}

      <Pagination
        basePath="/students"
        page={data.pagination.page}
        pageCount={data.pagination.pageCount}
        params={keep}
      />
    </main>
  );
}
