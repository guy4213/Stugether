"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { DoorOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptRoomInvitation, declineRoomInvitation } from "@/lib/notifications/actions";
import type { PendingInvitation } from "@/lib/repositories/invitations";

// "ROOMS instead of GROUPS" per the client's notes — invitations here are
// always to a room, so the copy says "room", never "group"/"lesson".
export function InvitationRow({ invitation }: { invitation: PendingInvitation }) {
  const [isPending, startTransition] = useTransition();

  function respond(action: "accept" | "decline") {
    startTransition(async () => {
      const result =
        action === "accept"
          ? await acceptRoomInvitation(invitation.id)
          : await declineRoomInvitation(invitation.id);
      if (!result.ok) toast.error(result.error ?? "משהו השתבש");
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <DoorOpenIcon className="size-4" />
        </span>
        <div>
          <p className="text-sm">
            <span className="font-medium">{invitation.inviter_name}</span> הזמין/ה אותך לחדר{" "}
            <span className="font-medium">{invitation.room_name}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {invitation.course_code ? `${invitation.course_code} · ` : ""}
            {invitation.course_name}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" disabled={isPending} onClick={() => respond("accept")}>
          אישור
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => respond("decline")}>
          דחייה
        </Button>
      </div>
    </div>
  );
}
