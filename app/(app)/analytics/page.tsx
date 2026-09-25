import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AwardIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  DoorOpenIcon,
  FlagIcon,
  LockIcon,
  MessageCircleIcon,
  RocketIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ShareButton } from "@/components/analytics/share-button";
import { ActivityChart } from "@/components/analytics/activity-chart";
import { SubjectDonut } from "@/components/analytics/subject-donut";
import { getCurrentUser } from "@/lib/auth/session";
import { getAnalyticsData } from "@/lib/analytics/queries";

const ACHIEVEMENT_ICONS: LucideIcon[] = [RocketIcon, FlagIcon, UsersIcon, AwardIcon];

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getAnalyticsData(user.id);

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">ההתקדמות שלי</h1>
          <p className="mt-1 text-muted-foreground">מבט על הלמידה שלך בשבועות האחרונים</p>
        </div>
        <ShareButton completedCount={data.completedCourses.length} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={BookOpenIcon}
          value={data.activeCourses.length}
          label="קורסים פעילים"
          tone="teal"
        />
        <StatCard
          icon={CheckCircle2Icon}
          value={data.completedCourses.length}
          label="קורסים שהושלמו"
          tone="blue"
        />
        <StatCard
          icon={DoorOpenIcon}
          value={data.activeRoomsCount}
          label="חדרי לימוד"
          tone="purple"
        />
        <StatCard
          icon={MessageCircleIcon}
          value={data.messagesSent}
          label="הודעות ב-8 שבועות"
          tone="orange"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-0 shadow-sm ring-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              פעילות למידה — הודעות לפי שבוע
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart weekly={data.weekly} />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-0">
          <CardHeader>
            <CardTitle className="text-base font-semibold">הישגים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.achievements.map((a, i) => {
              const Icon = a.earned ? ACHIEVEMENT_ICONS[i] : LockIcon;
              return (
                <div
                  key={a.title}
                  className={cn("flex items-center gap-3", !a.earned && "opacity-50")}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      a.earned
                        ? "bg-linear-to-br from-primary to-secondary text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.description}
                      {!a.earned && " (טרם הושג)"}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm ring-0">
          <CardHeader>
            <CardTitle className="text-base font-semibold">התקדמות לפי קורס</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.activeCourses.length === 0 && (
              <p className="text-sm text-muted-foreground">אין קורסים פעילים כרגע.</p>
            )}
            {data.activeCourses.map((enrollment) => (
              <Link key={enrollment.id} href={`/courses/${enrollment.course_id}`} className="block">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{enrollment.course.name}</span>
                  <span className="font-semibold tabular-nums">{enrollment.progress_percent}%</span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={enrollment.progress_percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`התקדמות ב${enrollment.course.name}`}
                >
                  <div
                    className="h-full rounded-full bg-linear-to-l from-primary to-secondary"
                    style={{ width: `${enrollment.progress_percent}%` }}
                  />
                </div>
              </Link>
            ))}
            {data.completedCourses.map((enrollment) => (
              <div key={enrollment.id} className="flex items-center gap-2 text-sm">
                <CheckCircle2Icon className="size-4 text-[oklch(0.55_0.13_165)]" />
                <span className="font-medium">{enrollment.course.name}</span>
                <span className="ms-auto rounded-full bg-[oklch(0.94_0.05_175)] px-2 py-0.5 text-xs font-medium text-[oklch(0.4_0.1_180)]">
                  הושלם
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-0">
          <CardHeader>
            <CardTitle className="text-base font-semibold">פילוח לפי מחלקה</CardTitle>
          </CardHeader>
          <CardContent>
            <SubjectDonut subjects={data.subjects} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
