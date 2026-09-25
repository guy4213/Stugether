import Link from "next/link";
import { ArrowLeftIcon, MessageSquareIcon } from "lucide-react";
import { cn } from "cn";
import { HeroCard } from "@/components/dashboard/hero-card";
import { MyCourseCard, RecommendationCard } from "@/components/dashboard/course-cards";
import { ActivityRail } from "@/components/dashboard/activity-rail";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";
import { greetingHe } from "@/lib/ui/format";

function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden>
      <path d="M12 2.5c.9 3.3 5.5 5.4 5.5 10.4a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4 2.4-5.1.2 2 1.1 3.2 2.5 3.6C10.8 8.6 11.1 5.2 12 2.5z" />
    </svg>
  );
}

// Dashboard per Hybrid.dc.html ("דשבורד — היברידי בהיר").
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null; // guarded by app/(app)/layout.tsx

  const data = await getDashboardData(user.id);
  const myCourses = data.myCourses.slice(0, 3);
  const recommendations = data.recommendations.slice(0, 3);

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 pt-7 pb-10 sm:px-8 xl:px-12"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] text-muted-foreground">
            {greetingHe()}
            {data.firstName ? `, ${data.firstName}` : ""}
          </span>
          <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.5px] sm:text-[38px]">
            עם מי לומדים היום?
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-9 items-center gap-1.5 rounded-full bg-warning-soft px-3.5 text-sm font-semibold text-warning-ink">
            <FlameIcon />
            {data.streak === 1 ? "יום אחד ברצף" : `${data.streak} ימים ברצף`}
          </span>
          <span className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-sm font-semibold">
            <MessageSquareIcon className="size-4 text-primary" strokeWidth={2.2} aria-hidden />
            {data.messagesThisWeek} הודעות השבוע
          </span>
        </div>
      </div>

      <HeroCard hero={data.hero} stats={data.stats} />

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 grow flex-col gap-7">
          <section aria-labelledby="my-courses" className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h2 id="my-courses" className="text-2xl font-extrabold">
                הקורסים שלי
              </h2>
              <Link
                href="/analytics"
                className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-strong"
              >
                הצג הכל
                <ArrowLeftIcon className="size-4" strokeWidth={2.2} aria-hidden />
              </Link>
            </div>
            {myCourses.length === 0 ? (
              <div className="rounded-[20px] border-2 border-dashed border-switch-off bg-surface-2 p-8 text-center">
                <p className="font-bold">עוד לא נרשמת לקורסים</p>
                <Link href="/courses" className="text-sm font-semibold text-primary">
                  למציאת קורס
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {myCourses.map((course, i) => (
                  <MyCourseCard key={course.id} course={course} highlight={i === 0} />
                ))}
              </div>
            )}
          </section>

          {recommendations.length > 0 && (
            <section aria-labelledby="discover" className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center gap-4">
                <h2 id="discover" className="text-2xl font-extrabold">
                  לגלות קורסים חדשים
                </h2>
                <nav aria-label="סינון לפי מחלקה" className="flex flex-wrap gap-1.5">
                  <Chip href="/courses" active>
                    הכל
                  </Chip>
                  {data.departments.slice(0, 3).map((d) => (
                    <Chip key={d.id} href={`/courses?departmentId=${d.id}`}>
                      {d.name}
                    </Chip>
                  ))}
                </nav>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {recommendations.map((c) => (
                  <RecommendationCard key={c.id} course={c} />
                ))}
              </div>
            </section>
          )}
        </div>

        <ActivityRail
          activity={data.activity}
          unreadCount={data.unreadCount}
          nextEvent={data.nextEvent}
        />
      </div>
    </main>
  );
}

function Chip({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-9 items-center rounded-full px-4 text-[13px]",
        active
          ? "bg-primary font-semibold text-white"
          : "border border-border bg-white font-medium text-ink-2 hover:border-primary-line",
      )}
    >
      {children}
    </Link>
  );
}
