import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UsersIcon, MessageSquareIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnrollButton } from "@/components/courses/enroll-button";
import { CreateRoomForm } from "@/components/courses/create-room-form";
import { AddTestForm } from "@/components/courses/add-test-form";
import { RosterList } from "@/components/courses/roster-list";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourseDetailData } from "@/lib/courses/detail-queries";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id: courseId } = await params;
  const { course, isEnrolled, activeRoomCount, myRoomsForCourse, classmates, tests } =
    await getCourseDetailData(user.id, courseId);

  if (!course) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {course.code && <p className="text-sm text-muted-foreground">{course.code}</p>}
          <h1 className="text-xl font-semibold">{course.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <UsersIcon className="size-4" />
            {activeRoomCount} חדרי לימוד פעילים
          </p>
        </div>
        <EnrollButton courseId={course.id} isEnrolled={isEnrolled} />
      </div>

      {isEnrolled && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>חדרי הלימוד שלי בקורס</CardTitle>
            <CreateRoomForm courseId={course.id} />
          </CardHeader>
          <CardContent className="space-y-2">
            {myRoomsForCourse.length === 0 && (
              <p className="text-sm text-muted-foreground">עדיין לא הצטרפת לחדר לימוד בקורס הזה.</p>
            )}
            {myRoomsForCourse.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <MessageSquareIcon className="size-4 text-primary" />
                  <span className="text-sm font-medium">{room.name}</span>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/rooms/${room.id}`}>כניסה לחדר</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>מבחנים</CardTitle>
          {isEnrolled && <AddTestForm courseId={course.id} />}
        </CardHeader>
        <CardContent className="space-y-2">
          {tests.length === 0 && (
            <p className="text-sm text-muted-foreground">אין מבחנים מתוכננים.</p>
          )}
          {tests.map((test) => (
            <div key={test.id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{test.title}</p>
              {test.description && (
                <p className="text-xs text-muted-foreground">{test.description}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>סטודנטים בקורס</CardTitle>
        </CardHeader>
        <CardContent>
          <RosterList classmates={classmates} />
        </CardContent>
      </Card>
    </main>
  );
}
