"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinOpenRoomAction } from "@/lib/rooms/actions";

// Joins an open room of one of my courses; the action redirects into it.
export function JoinRoomButton({
  roomId,
  children = "הצטרפות",
  ...props
}: { roomId: string; children?: ReactNode } & Omit<
  React.ComponentProps<typeof Button>,
  "onClick" | "children"
>) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await joinOpenRoomAction(roomId);
          if (result && !result.ok) toast.error(result.error);
        })
      }
      {...props}
    >
      {children}
    </Button>
  );
}
