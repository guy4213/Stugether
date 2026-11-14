"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EllipsisIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { unenrollFromCourse } from "@/lib/courses/actions";

// The "⋯" of a "הקורסים שלי" card on the dashboard: continue, details, and
// "הסרת הקורס" (client QA 11.2026).
export function DashboardCourseMenu({
  courseId,
  courseName,
  continueHref,
}: {
  courseId: string;
  courseName: string;
  continueHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`להסיר את "${courseName}" מהקורסים שלך?`)) return;
    startTransition(async () => {
      const result = await unenrollFromCourse(courseId);
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      toast.success("הקורס הוסר מהקורסים שלך");
      router.refresh();
    });
  }

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger
        aria-label={`אפשרויות לקורס ${courseName}`}
        disabled={pending}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <EllipsisIcon className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={continueHref}>
            המשך ללמוד
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={`/courses/${courseId}`}>
            פרטי הקורס
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={remove}>
          <Trash2Icon />
          הסרת הקורס
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
