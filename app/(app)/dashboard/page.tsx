import Link from "next/link";
import { BookOpenIcon, MessageSquareIcon, UsersIcon, MailIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActiveRoomsCard } from "@/components/dashboard/active-rooms-card";
import { TestsCard } from "@/components/dashboard/tests-card";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";

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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold">
          בוקר טוב, {profile?.full_name.split(" ")[0] ?? ""}! 👋
        </h1>
        <p className="text-sm text-muted-foreground">מוכנים ללמוד משהו חדש היום?</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={BookOpenIcon} value={activeCourses.length} label="קורסים פעילים" />
        <StatCard icon={MessageSquareIcon} value={activeRooms.length} label="חדרים פעילים" />
        <StatCard icon={UsersIcon} value={activeStudentsCount} label="סטודנטים פעילים" />
        <StatCard icon={MailIcon} value={pendingInvitations.length} label="הזמנות ממתינות" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ActiveRoomsCard rooms={activeRooms} courseNameById={courseNameById} />
        <TestsCard tests={tests} />
      </div>

      {continueLearning && (
        <Card>
          <CardHeader>
            <CardTitle>המשך למידה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{continueLearning.course.name}</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${continueLearning.progress_percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {continueLearning.progress_percent}% הושלם
                </p>
              </div>
              <Button asChild>
                <Link href={`/courses/${continueLearning.course_id}`}>המשך</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
