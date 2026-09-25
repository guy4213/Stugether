"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inviteToStudy } from "@/lib/rooms/actions";

export function InviteToStudyButton({
  courseId,
  inviteeId,
  inviteeName,
  topicTitle,
}: {
  courseId: string;
  inviteeId: string;
  inviteeName: string;
  topicTitle: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <Button
      type="button"
      variant="brand"
      className="h-[46px] rounded-[14px] text-[15px] shadow-none"
      disabled={pending || sent}
      onClick={() =>
        startTransition(async () => {
          const result = await inviteToStudy(courseId, inviteeId, topicTitle);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setSent(true);
          toast.success(`נשלחה הזמנה ל${inviteeName}`);
        })
      }
    >
      {sent ? "ההזמנה נשלחה" : pending ? "שולח..." : "הזמנה ללמידה"}
    </Button>
  );
}
