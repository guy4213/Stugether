"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelJoinRequestAction, joinOpenRoomAction } from "@/lib/rooms/actions";

// Joins an open room of one of my courses; the action redirects into it. A
// room in session ("live") asks its creator first — the button then waits
// for the approval and can withdraw the request.
export function JoinRoomButton({
  roomId,
  children = "הצטרפות",
  live = false,
  requested: initiallyRequested = false,
  ...props
}: {
  roomId: string;
  children?: ReactNode;
  /** In session: the label says it is a request. */
  live?: boolean;
  /** A request of mine is already waiting. */
  requested?: boolean;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "children">) {
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState(initiallyRequested);

  if (requested) {
    return (
      <Button
        type="button"
        disabled={pending}
        {...props}
        variant="quiet"
        title="ביטול הבקשה"
        onClick={() =>
          startTransition(async () => {
            const result = await cancelJoinRequestAction(roomId);
            if (!result.ok) toast.error(result.error);
            else {
              setRequested(false);
              toast.success("הבקשה בוטלה");
            }
          })
        }
      >
        ממתין לאישור · ביטול
      </Button>
    );
  }

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await joinOpenRoomAction(roomId);
          if (!result) return;
          if (!result.ok) toast.error(result.error);
          else if (result.requested) {
            setRequested(true);
            toast.success("החדר באמצע מפגש — הבקשה נשלחה ליוצר/ת החדר לאישור");
          }
        })
      }
      {...props}
    >
      {live ? "בקשת הצטרפות" : children}
    </Button>
  );
}
