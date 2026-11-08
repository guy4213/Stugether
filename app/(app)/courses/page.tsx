import { redirect } from "next/navigation";
import Link from "next/link";
import { CourseSearchBox, CoursesFilterBar } from "@/components/courses/filter-bar";
import { CourseCard } from "@/components/courses/course-card";
import { getCurrentUser } from "@/lib/auth/session";
import { Pagination } from "@/components/ui/pagination";
import {
  getCoursesPageData,
  parseCoursePage,
  parseCourseSort,
  parseCourseView,
  type CourseCardData,
} from "@/lib/courses/queries";

const CONTAINER = "mx-auto w-full max-w-[1440px] px-4 sm:px-8 xl:px-12";
const GRID = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 min-[87.5rem]:grid-cols-4";

// The card needs neither the raw course row nor the sort key.
function toCard({ course, examSortKey, ...card }: CourseCardData) {
  void course;
  void examSortKey;
  return card;
}

// "קורסים" per the Figma (Change Request 07.11.2026): a gradient hero with
// search and counters, filter chips, then "הקורסים שלי" and "כל הקורסים".
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    departmentId?: string;
    view?: string;
    favorites?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { q, departmentId, view: rawView, favorites, sort, page } = await searchParams;
  const view = parseCourseView(rawView, favorites);
  const data = await getCoursesPageData(user.id, {
    q,
    departmentId,
    view,
    sort: parseCourseSort(sort, departmentId),
    page: parseCoursePage(page),
  });
  const filtered = Boolean(q || departmentId || view !== "all");
  const showMine = view === "mine" || data.myCourses.length > 0;
  const showAll = view !== "mine";

  return (
    <main id="main-content" className="flex w-full flex-1 flex-col">
      <div className="border-b border-[#e9edf4] bg-[#f6f8fc]">
        <div className={`${CONTAINER} pt-8 pb-[26px]`}>
          <section className="relative flex flex-col gap-8 overflow-hidden rounded-[30px] bg-figma-hero px-6 py-8 shadow-[0_10px_30px_rgba(80,146,241,.18)] sm:px-[46px] lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-[120px] left-[240px] size-[300px] rounded-full bg-white/8"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute top-[90px] -left-[170px] size-[340px] rounded-full bg-white/8"
            />
            <div className="relative max-w-[858px] grow">
              <h1 className="text-[30px] leading-[1.1] font-extrabold text-white sm:text-[40px]">
                מצאו את הקורס המתאים לכם
              </h1>
              <p className="mt-2 text-[17px] text-white">
                מצאו סטודנטים מהקורס שלכם והתחילו ללמוד יחד.
              </p>
              {data.institutionId && (
                <div className="mt-5">
                  <CourseSearchBox />
                </div>
              )}
            </div>
            {data.institutionId && (
              <dl className="relative grid shrink-0 grid-cols-3 gap-2 sm:flex sm:gap-3">
                <HeroStat label="קורסים" value={data.totals.courses} />
                <HeroStat label="סטודנטים" value={data.totals.students} />
                <HeroStat label="חדרי לימוד פעילים" value={data.totals.liveRooms} live />
              </dl>
            )}
          </section>

          {data.institutionId && (
            <div className="mt-[30px]">
              <CoursesFilterBar departments={data.departments} />
            </div>
          )}
        </div>
      </div>

      <div className={`${CONTAINER} flex flex-col gap-[72px] pt-5 pb-20`}>
        {!data.institutionId ? (
          <EmptyBox>
            כדי לראות את קטלוג הקורסים, בחרו מוסד לימודים בפרופיל.{" "}
            <Link href="/profile" className="font-semibold text-primary">
              להשלמת הפרופיל
            </Link>
          </EmptyBox>
        ) : (
          <>
            {showMine && (
              <section aria-labelledby="my-courses">
                <h2 id="my-courses" className="mb-[30px] text-2xl font-bold">
                  הקורסים שלי
                </h2>
                {data.myCourses.length === 0 ? (
                  <EmptyBox>
                    {data.hasEnrollments ? (
                      <>
                        אין קורסים שלך שתואמים לסינון.{" "}
                        <Link href="/courses?view=mine" className="font-semibold text-primary">
                          ניקוי הסינון
                        </Link>
                      </>
                    ) : (
                      <>
                        עוד לא נרשמת לקורסים.{" "}
                        <Link href="/courses" className="font-semibold text-primary">
                          לכל הקורסים
                        </Link>
                      </>
                    )}
                  </EmptyBox>
                ) : (
                  <div className={GRID}>
                    {data.myCourses.map((c) => (
                      <CourseCard key={c.id} card={toCard(c)} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {showAll && (
              <section aria-labelledby="all-courses" className="flex flex-col">
                <h2 id="all-courses" className="mb-[30px] text-2xl font-bold">
                  כל הקורסים
                </h2>
                {data.otherCourses.length === 0 ? (
                  <EmptyBox>
                    {view === "favorites"
                      ? "אין עוד קורסים נעוצים. נועצים קורס מתפריט ⋯ שבכרטיס."
                      : "לא נמצאו קורסים נוספים."}{" "}
                    {filtered && (
                      <Link href="/courses" className="font-semibold text-primary">
                        ניקוי החיפוש והסינון
                      </Link>
                    )}
                  </EmptyBox>
                ) : data.semesterGroups ? (
                  <div className="flex flex-col gap-10">
                    {data.semesterGroups.map((group) => (
                      <section key={group.key} className="flex flex-col gap-4">
                        <h3 className="text-lg font-bold">
                          {group.label}
                          <span className="ms-2 text-sm font-medium text-muted-foreground">
                            {group.total === 1 ? "קורס אחד" : `${group.total} קורסים`}
                          </span>
                        </h3>
                        <div className={GRID}>
                          {group.courses.map((c) => (
                            <CourseCard key={c.id} card={toCard(c)} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className={GRID}>
                    {data.otherCourses.map((c) => (
                      <CourseCard key={c.id} card={toCard(c)} />
                    ))}
                  </div>
                )}

                <div className="mt-8">
                  <Pagination
                    basePath="/courses"
                    page={data.pagination.page}
                    pageCount={data.pagination.pageCount}
                    params={{ q, departmentId, view: rawView, sort }}
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[22px] border-2 border-dashed border-[#dbe5f5] bg-white/60 p-8 text-center text-[#737885]">
      {children}
    </p>
  );
}

function HeroStat({
  label,
  value,
  live = false,
}: {
  label: string;
  value: number;
  live?: boolean;
}) {
  return (
    <div className="flex h-[86px] flex-col justify-between rounded-[18px] border border-white/35 bg-white/16 px-3 py-3 text-white backdrop-blur-[4px] sm:w-[170px] sm:px-4 sm:py-3.5">
      <dt className="flex items-center gap-1.5 text-[13px] leading-tight sm:text-[15px]">
        {live && (
          <span
            aria-hidden
            className="size-2 rounded-full bg-[#3ee08a] shadow-[0_0_0_3px_rgba(62,224,138,.3)]"
          />
        )}
        {label}
      </dt>
      <dd className="text-[26px] leading-none font-extrabold sm:text-[32px]">{value}</dd>
    </div>
  );
}
