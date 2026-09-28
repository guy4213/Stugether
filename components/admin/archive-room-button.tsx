"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { archiveRoomAction } from "@/lib/admin/actions";

export function ArchiveRoomButton({ roomId, name }: { roomId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="quiet"
      size="xs"
      className="h-8 px-3"
      disabled={pending}
      onClick={() => {
        if (!confirm(`לארכב את "${name}"? החדר יהפוך לקריאה בלבד למשתתפים.`)) return;
        startTransition(async () => {
          const result = await archiveRoomAction(roomId);
          if (!result.ok) toast.error(result.error ?? "הפעולה נכשלה");
          else toast.success("החדר אורכב");
        });
      }}
    >
      ארכוב
    </Button>
  );
}
