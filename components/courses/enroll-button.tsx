"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrollInCourse, unenrollFromCourse } from "@/lib/courses/actions";

// "white"  — the banner's primary CTA when not enrolled ("הרשמה לקורס")
// "remove" — the quiet red link under the members list
export function EnrollButton({
  courseId,
  isEnrolled,
  variant = "white",
}: {
  courseId: string;
  isEnrolled: boolean;
  variant?: "white" | "remove";
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = isEnrolled
        ? await unenrollFromCourse(courseId)
        : await enrollInCourse(courseId);
      if (!result.ok) toast.error(result.error ?? "משהו השתבש");
      else toast.success(isEnrolled ? "הקורס הוסר מהרשימה שלך" : "נרשמת לקורס בהצלחה");
    });
  }

  if (variant === "remove") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="mt-1 h-9 self-start text-[13px] font-semibold text-destructive hover:underline disabled:opacity-50"
      >
        הסרת הקורס מהרשימה שלי
      </button>
    );
  }

  return (
    <Button onClick={handleClick} disabled={isPending} variant="white" size="xl" className="px-[26px] text-base">
      {isEnrolled ? "ביטול הרשמה" : "הרשמה לקורס"}
    </Button>
  );
}
