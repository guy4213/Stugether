"use client";

import { useTransition } from "react";
import { MessageSquareTextIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/lib/messages/actions";

// "שליחת הודעה" (SPEC §5.1): opens the private chat with a student — created
// on first use — and goes there. A button (Server Action), not a link, so
// prefetching never creates conversations.
export function MessageStudentButton({
  studentId,
  studentName,
  compact = false,
  className,
  iconClassName,
}: {
  studentId: string;
  studentName: string;
  /** Icon-only square (the student card, the dashboard partners). */
  compact?: boolean;
  className?: string;
  /** Icon size in the compact square (default 18px). */
  iconClassName?: string;
}) {
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await startConversationAction(studentId);
      // Success redirects to the chat and never returns here.
      if (result && !result.ok) toast.error(result.error ?? "לא ניתן לפתוח שיחה");
    });
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={open}
        disabled={pending}
        aria-label={`שליחת הודעה ל${studentName}`}
        title="שליחת הודעה"
        className={cn(
          "flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-primary hover:bg-primary-soft disabled:opacity-60",
          className,
        )}
      >
        <MessageSquareTextIcon
          className={cn("size-[18px]", iconClassName, pending && "animate-pulse")}
          aria-hidden
        />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline-primary"
      size="md"
      onClick={open}
      disabled={pending}
      className={className}
    >
      <MessageSquareTextIcon aria-hidden />
      {pending ? "פותח שיחה..." : "שליחת הודעה"}
    </Button>
  );
}
