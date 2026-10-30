import { redirect } from "next/navigation";
import Link from "next/link";
import { StudentCard } from "@/components/students/student-card";
import { StudentFilters } from "@/components/students/student-filters";
import { Pagination } from "@/components/ui/pagination";
import { getCurrentUser } from "@/lib/auth/session";
import { getStudentsPageData } from "@/lib/students/queries";
import { parseCoursePage } from "@/lib/courses/queries";
import {
  STUDY_TIMES,
  STUDY_TRACKS,
  type StudyTime,
  type StudyTrack,
} from "@/lib/constants/profile-options";

// Student directory (Change Request 13.10.2026; Figma "כרטיסיות סטודנטים"
// 30.10.2026): every student on the platform, best match first.
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
    track?: string;
    times?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const year = Number.parseInt(params.year ?? "", 10);
  const track = STUDY_TRACKS.find((t) => t === params.track) as StudyTrack | undefined;
  const studyTimes = (params.times ?? "")
    .split(",")
    .filter((t): t is StudyTime => (STUDY_TIMES as readonly string[]).includes(t));
  const data = await getStudentsPageData(user.id, {
    q: params.q,
    institutionId: params.institutionId,
    departmentId: params.departmentId,
    year: Number.isFinite(year) ? year : undefined,
    courseId: params.courseId,
    online: params.online === "1",
    track,
    studyTimes,
    page: parseCoursePage(params.page),
  });
  // Page links keep every filter; ?page is set by the link itself.
  const keep = { ...params, page: undefined };

  return (
    <main id="main-content" className="flex w-full flex-1 flex-col">
      <div className="bg-surface-2">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 pt-9 pb-8 sm:px-8 xl:px-24">
          <header className="flex flex-col gap-1.5">
            <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.5px]">סטודנטים</h1>
            <p className="text-[17px] text-muted-foreground">
              מצא שותפים ללמידה לפי קורס, פקולטה, מחלקה ומסלול לימודים.
            </p>
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
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 xl:px-[76px]">
        {data.students.length === 0 ? (
          <p className="rounded-[22px] border-2 border-dashed border-switch-off bg-surface-2 p-8 text-center text-muted-foreground">
            לא נמצאו סטודנטים תואמים.{" "}
            <Link href="/students" className="font-semibold text-primary">
              ניקוי הסינון
            </Link>
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
            {data.students.map((s) => (
              <li key={s.profile.id}>
                <StudentCard student={s} />
              </li>
            ))}
          </ul>
        )}

        <Pagination
          basePath="/students"
          page={data.pagination.page}
          pageCount={data.pagination.pageCount}
          params={keep}
        />
      </div>
    </main>
  );
}
