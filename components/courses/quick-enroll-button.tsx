"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrollInCourse } from "@/lib/courses/actions";

// The "+" on dashboard course recommendations.
export function QuickEnrollButton({ courseId, courseName }: { courseId: string; courseName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline-primary"
      size="icon-md"
      aria-label={`הוספת ${courseName}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await enrollInCourse(courseId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`נרשמת ל${courseName}`);
          router.refresh();
        })
      }
    >
      <PlusIcon strokeWidth={2.6} />
    </Button>
  );
}
