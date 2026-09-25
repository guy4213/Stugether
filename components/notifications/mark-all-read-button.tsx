"use client";

import { useTransition } from "react";
import { CheckCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/lib/notifications/actions";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="soft"
      className="h-10 px-3.5 text-sm"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllNotificationsRead();
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      <CheckCheckIcon className="size-4" strokeWidth={2.4} />
      סימון הכל כנקרא
    </Button>
  );
}
