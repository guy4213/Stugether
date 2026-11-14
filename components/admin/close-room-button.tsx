"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { closeRoomAction } from "@/lib/admin/actions";

// Admin moderation: close a room (read-only for its members, final). It
// replaced "ארכוב" when archiving was removed (client QA 12.11.2026).
export function CloseRoomButton({ roomId, name }: { roomId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="quiet"
      size="xs"
      className="h-8 px-3"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            `לסגור את "${name}"? החדר יהפוך לקריאה בלבד למשתתפים, ולא ניתן יהיה לפתוח אותו מחדש.`,
          )
        )
          return;
        startTransition(async () => {
          const result = await closeRoomAction(roomId);
          if (!result.ok) toast.error(result.error ?? "הפעולה נכשלה");
          else toast.success("החדר נסגר");
        });
      }}
    >
      סגירה
    </Button>
  );
}
