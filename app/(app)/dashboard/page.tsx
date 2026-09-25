import Link from "next/link";
import { BookOpenIcon, MessageSquareIcon, UsersIcon, MailIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActiveRoomsCard } from "@/components/dashboard/active-rooms-card";
import { TestsCard } from "@/components/dashboard/tests-card";
import { CourseCover } from "@/components/courses/course-cover";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }),
  );
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  return "ערב טוב";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null; // guarded by app/(app)/layout.tsx

  const {
    profile,
    activeRooms,
    activeCourses,
    courseNameById,
    pendingInvitations,
    activeStudentsCount,
    tests,
    continueLearning,
  } = await getDashboardData(user.id);

  const firstName = profile?.full_name.split(" ")[0] ?? "";

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">
          {greeting()}, {firstName}! 👋
        </h1>
        <p className="mt-1 text-muted-foreground">מוכנים ללמוד משהו חדש היום?</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={BookOpenIcon}
          value={activeCourses.length}
          label="קורסים פעילים"
          tone="teal"
        />
        <StatCard
          icon={MessageSquareIcon}
          value={activeRooms.length}
          label="חדרים פעילים"
          tone="blue"
        />
        <StatCard
          icon={UsersIcon}
          value={activeStudentsCount}
          label="סטודנטים פעילים"
          tone="purple"
        />
        <StatCard
          icon={MailIcon}
          value={pendingInvitations.length}
          label="הזמנות לחדרים"
          tone="orange"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <ActiveRoomsCard rooms={activeRooms} courseNameById={courseNameById} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <TestsCard tests={tests} />
        </div>
      </div>

      {continueLearning && (
        <Card className="border-0 shadow-sm ring-0">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">המשך למידה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <CourseCover
                seed={continueLearning.course_id}
                label={`${continueLearning.course.name} ${continueLearning.course.code ?? ""}`}
                className="h-24 w-full shrink-0 rounded-xl sm:w-40"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{continueLearning.course.name}</p>
                <p className="text-sm text-muted-foreground">
                  {continueLearning.course.code ?? ""}
                  {continueLearning.course.semester ? ` · ${continueLearning.course.semester}` : ""}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={continueLearning.progress_percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`התקדמות ב${continueLearning.course.name}`}
                  >
                    <div
                      className="h-full rounded-full bg-linear-to-l from-primary to-secondary"
                      style={{ width: `${continueLearning.progress_percent}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {continueLearning.progress_percent}%
                  </span>
                </div>
              </div>
              <Button asChild variant="gradient" size="lg" className="px-6">
                <Link href={`/courses/${continueLearning.course_id}`}>המשך</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
