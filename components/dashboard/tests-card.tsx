import { ClipboardListIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CourseTestWithCourse } from "@/lib/repositories/tests";

function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return "ללא מועד";
  return new Date(dueAt).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

// Replaces the static "Assignments" mock with real, DB-driven test items.
export function TestsCard({ tests }: { tests: CourseTestWithCourse[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>מבחנים קרובים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tests.length === 0 && (
          <p className="text-sm text-muted-foreground">אין מבחנים קרובים בקורסים שלך.</p>
        )}
        {tests.map((test) => (
          <div
            key={test.id}
            className="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary-foreground">
              <ClipboardListIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{test.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {test.course.code ? `${test.course.code} · ` : ""}
                {test.course.name}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDueDate(test.due_at)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
