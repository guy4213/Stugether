import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { MyCourseCard } from "@/components/dashboard/course-cards";
import { ActivityRail } from "@/components/dashboard/activity-rail";
import { RoomsPanel } from "@/components/dashboard/rooms-panel";
import { PartnersSection } from "@/components/dashboard/partners-section";
import { SectionHeader } from "@/components/dashboard/section-header";
import { InfoTiles } from "@/components/dashboard/side-cards";
import { ProgressCard } from "@/components/dashboard/progress-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getMyFriendStates } from "@/lib/friends/queries";
import { getCourseActivity } from "@/lib/activity/queries";

// Dashboard (redesign 07.11.2026): three rows, each a main block with a side
// block next to it — partners | my progress, study rooms | recent activity,
// my courses | general info. Below xl the blocks stack in that order.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null; // guarded by app/(app)/layout.tsx

  const [data, friends, activity] = await Promise.all([
    getDashboardData(user.id),
    getMyFriendStates(user.id),
    getCourseActivity(user.id, { limit: 4 }),
  ]);
  const myCourses = data.myCourses;

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-7 px-4 pt-7 pb-10 sm:px-8 xl:px-12"
    >
      <h1 className="text-[30px] leading-[1.2] font-extrabold tracking-[-0.5px] sm:text-[36px]">
        {data.firstName ? `היי ${data.firstName}` : "היי"}{" "}
        <span aria-hidden className="inline-block">
          👋
        </span>
        <br />
        עם מי לומדים היום?
      </h1>

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PartnersSection
          partners={data.partners}
          hasCourses={data.myCourses.length > 0}
          friends={friends}
        />
        <ProgressCard heroes={data.heroes} stats={data.stats} />

        <RoomsPanel
          rooms={data.rooms}
          invitations={data.pendingInvitations}
          courses={data.roomCourses}
        />
        <ActivityRail items={activity} nextEvent={data.nextEvent} />

        <section aria-labelledby="my-courses" className="flex min-w-0 flex-col gap-3.5">
          <SectionHeader
            id="my-courses"
            title="הקורסים שלי"
            actions={
              <Link
                href="/courses#all-courses"
                aria-label="הוספת קורסים"
                title="הוספת קורסים"
                className="flex size-9 items-center justify-center rounded-[10px] border border-primary-line bg-white text-primary transition-colors hover:bg-primary-soft"
              >
                <PlusIcon className="size-[18px]" strokeWidth={2.6} aria-hidden />
              </Link>
            }
            link={{ href: "/courses", label: "כל הקורסים" }}
          />
          {myCourses.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-switch-off bg-surface-2 p-8 text-center">
              <p className="font-bold">עוד לא נרשמת לקורסים</p>
              <Link href="/courses" className="text-sm font-semibold text-primary">
                למציאת קורס
              </Link>
            </div>
          ) : (
            // Every course, scrolling sideways (it used to show only 3).
            <ul
              aria-label="גללו לצדדים כדי לראות את כל הקורסים"
              className="-mx-4 flex flex-1 snap-x snap-mandatory [scrollbar-width:thin] gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:-mx-1 sm:px-1"
            >
              {myCourses.map((course) => (
                <li key={course.id} className="w-[280px] shrink-0 snap-start sm:w-[300px]">
                  <MyCourseCard course={course} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <InfoTiles stats={data.stats} pendingInvitations={data.pendingInvitationCount} />
      </div>
    </main>
  );
}
