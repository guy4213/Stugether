"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrollInCourse, unenrollFromCourse } from "@/lib/courses/actions";

export function EnrollButton({ courseId, isEnrolled }: { courseId: string; isEnrolled: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = isEnrolled
        ? await unenrollFromCourse(courseId)
        : await enrollInCourse(courseId);
      if (!result.ok) toast.error(result.error ?? "משהו השתבש");
      else toast.success(isEnrolled ? "בוטלה ההרשמה לקורס" : "נרשמת לקורס בהצלחה");
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending} variant={isEnrolled ? "outline" : "default"}>
      {isEnrolled ? "ביטול הרשמה" : "הרשמה לקורס"}
    </Button>
  );
}
