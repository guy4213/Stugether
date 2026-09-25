"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { toggleEventRegistration } from "@/lib/events/actions";

// Bookmark toggle on the "next event" card: register / unregister.
export function EventRegisterButton({
  courseId,
  eventId,
  initialRegistered,
}: {
  courseId: string;
  eventId: string;
  initialRegistered: boolean;
}) {
  const [registered, setRegistered] = useState(initialRegistered);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={registered}
      aria-label={registered ? "ביטול הרשמה לאירוע" : "הרשמה לאירוע"}
      disabled={pending}
      onClick={() => {
        const next = !registered;
        setRegistered(next);
        startTransition(async () => {
          const result = await toggleEventRegistration(courseId, eventId, next);
          if (!result.ok) {
            setRegistered(!next);
            toast.error(result.error);
          } else if (next) toast.success("נרשמת לאירוע");
        });
      }}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-[13px] border transition-colors",
        registered
          ? "border-primary bg-primary text-white"
          : "border-border bg-white text-primary-strong hover:bg-primary-soft",
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={registered ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
    </button>
  );
}
