"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrollInCourse } from "@/lib/courses/actions";

// The "+" that adds a course to "הקורסים שלי" (course cards, client QA 11.2026).
export function QuickEnrollButton({
  courseId,
  courseName,
  className,
}: {
  courseId: string;
  courseName: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline-primary"
      size="icon-md"
      aria-label={`הוספת ${courseName} לקורסים שלי`}
      title="הוספה לקורסים שלי"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          const result = await enrollInCourse(courseId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`${courseName} נוסף לקורסים שלך`);
          router.refresh();
        })
      }
    >
      <PlusIcon strokeWidth={2.6} />
    </Button>
  );
}
