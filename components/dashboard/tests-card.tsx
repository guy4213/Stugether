import Link from "next/link";
import { ClipboardListIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CourseTestWithCourse } from "@/lib/repositories/tests";

function dueLabel(dueAt: string | null): { text: string; urgent: boolean } {
  if (!dueAt) return { text: "ללא מועד", urgent: false };
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: "עבר", urgent: false };
  if (days === 0) return { text: "היום", urgent: true };
  if (days === 1) return { text: "מחר", urgent: true };
  return { text: `בעוד ${days} ימים`, urgent: days <= 3 };
}

// Replaces the static "Assignments" mock with real, DB-driven test items.
export function TestsCard({ tests }: { tests: CourseTestWithCourse[] }) {
  return (
    <Card className="border-0 shadow-sm ring-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">מבחנים קרובים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tests.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            אין מבחנים קרובים בקורסים שלך.
          </div>
        )}
        {tests.map((test) => {
          const due = dueLabel(test.due_at);
          return (
            <Link
              key={test.id}
              href={`/courses/${test.course_id}`}
              className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-accent/50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.95_0.05_65)] text-[oklch(0.5_0.14_55)]">
                <ClipboardListIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{test.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {test.course.code ? `${test.course.code} · ` : ""}
                  {test.course.name}
                </span>
              </span>
              <span
                className={
                  due.urgent
                    ? "shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
                    : "shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                }
              >
                {due.text}
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
