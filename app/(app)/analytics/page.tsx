import { redirect } from "next/navigation";
import { BookOpenIcon, CheckCircle2Icon, DoorOpenIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ShareButton } from "@/components/analytics/share-button";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnalyticsData } from "@/lib/analytics/queries";

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { activeCourses, completedCourses, activeRoomsCount } = await getAnalyticsData(user.id);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">ההתקדמות שלי</h1>
        <ShareButton completedCount={completedCourses.length} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard icon={BookOpenIcon} value={activeCourses.length} label="קורסים פעילים" />
        <StatCard icon={CheckCircle2Icon} value={completedCourses.length} label="קורסים שהושלמו" />
        <StatCard icon={DoorOpenIcon} value={activeRoomsCount} label="חדרי לימוד" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>התקדמות לפי קורס</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeCourses.length === 0 && (
            <p className="text-sm text-muted-foreground">אין קורסים פעילים כרגע.</p>
          )}
          {activeCourses.map((enrollment) => (
            <div key={enrollment.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{enrollment.course.name}</span>
                <span className="text-muted-foreground">{enrollment.progress_percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${enrollment.progress_percent}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {completedCourses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>קורסים שהושלמו</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedCourses.map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center gap-2 rounded-lg border border-border p-3"
              >
                <CheckCircle2Icon className="size-4 text-secondary-foreground" />
                <span className="text-sm font-medium">{enrollment.course.name}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
