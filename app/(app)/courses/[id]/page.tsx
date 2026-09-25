import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRightIcon,
  CalendarIcon,
  ClipboardListIcon,
  MessageSquareIcon,
  UsersIcon,
} from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnrollButton } from "@/components/courses/enroll-button";
import { CreateRoomForm } from "@/components/courses/create-room-form";
import { AddTestForm } from "@/components/courses/add-test-form";
import { RosterList } from "@/components/courses/roster-list";
import { CourseCover } from "@/components/courses/course-cover";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourseDetailData } from "@/lib/courses/detail-queries";

function formatDate(iso: string | null): string {
  if (!iso) return "ללא מועד";
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  });
}

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id: courseId } = await params;
  const {
    course,
    departmentName,
    isEnrolled,
    progressPercent,
    activeRoomCount,
    myRoomsForCourse,
    classmates,
    tests,
  } = await getCourseDetailData(user.id, courseId);

  if (!course) notFound();

  return (
    <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-8">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowRightIcon className="size-4" />
        חזרה לקורסים
      </Link>

      <Card className="gap-0 overflow-hidden border-0 py-0 shadow-sm ring-0">
        <div className="flex flex-col sm:flex-row">
          <CourseCover
            seed={course.id}
            label={`${course.name} ${course.code ?? ""}`}
            className="h-32 sm:h-auto sm:w-56"
            iconClassName="size-16"
          />
          <div className="flex flex-1 flex-col gap-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {[course.code, departmentName, course.semester].filter(Boolean).join(" · ")}
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">{course.name}</h1>
              </div>
              <EnrollButton courseId={course.id} isEnrolled={isEnrolled} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <UsersIcon className="size-4" />
                {classmates.length + (isEnrolled ? 1 : 0)} סטודנטים
              </span>
              <span className="flex items-center gap-1.5">
                <MessageSquareIcon className="size-4" />
                {activeRoomCount} חדרי לימוד פעילים
              </span>
              <span className="flex items-center gap-1.5">
                <ClipboardListIcon className="size-4" />
                {tests.length} מבחנים
              </span>
            </div>
            {isEnrolled && (
              <div className="flex items-center gap-3">
                <div
                  className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="ההתקדמות שלך בקורס"
                >
                  <div
                    className="h-full rounded-full bg-linear-to-l from-primary to-secondary"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums">{progressPercent}%</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Card className="border-0 shadow-sm ring-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold">סטודנטים בקורס</CardTitle>
              <p className="text-xs text-muted-foreground">
                אחוז ההתאמה מחושב לפי מוסד, פקולטה, מחלקה, שנת לימודים ועיר
              </p>
            </CardHeader>
            <CardContent>
              <RosterList classmates={classmates} />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card className="border-0 shadow-sm ring-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold">חדרי הלימוד שלי</CardTitle>
              {isEnrolled && (
                <CardAction>
                  <CreateRoomForm courseId={course.id} />
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {!isEnrolled && (
                <p className="text-sm text-muted-foreground">הירשמו לקורס כדי לפתוח חדר לימוד.</p>
              )}
              {isEnrolled && myRoomsForCourse.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  עדיין לא הצטרפת לחדר בקורס הזה — פתחו חדר חדש והזמינו חברים.
                </p>
              )}
              {myRoomsForCourse.map((room) => (
                <Link
                  key={room.id}
                  href={`/rooms/${room.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-accent/50"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MessageSquareIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{room.name}</span>
                    {room.topic && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {room.topic}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-primary">כניסה</span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold">מבחנים</CardTitle>
              {isEnrolled && (
                <CardAction>
                  <AddTestForm courseId={course.id} />
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {tests.length === 0 && (
                <p className="text-sm text-muted-foreground">אין מבחנים מתוכננים.</p>
              )}
              {tests.map((test) => (
                <div key={test.id} className="rounded-xl border border-border/60 p-3">
                  <p className="text-sm font-medium">{test.title}</p>
                  {test.description && (
                    <p className="text-xs text-muted-foreground">{test.description}</p>
                  )}
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarIcon className="size-3.5" />
                    {formatDate(test.due_at)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
