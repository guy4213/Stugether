"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { acceptRoomInvitation, declineRoomInvitation } from "@/lib/notifications/actions";
import type { PendingInvitation } from "@/lib/repositories/invitations";

// "יש לך הזמנה ללמידה" (client QA 12.11.2026): a room invitation pops up for
// the invitee — live when it arrives, or on the first page of a visit — with
// accept / not now / decline, instead of a toast that is easy to miss.
export function InvitationDialog({
  invitation,
  notificationId,
  onClose,
}: {
  invitation: PendingInvitation | null;
  notificationId?: string | null;
  /** "לא עכשיו", or after an answer. */
  onClose: (answered: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function answer(accept: boolean) {
    if (!invitation) return;
    startTransition(async () => {
      const result = accept
        ? await acceptRoomInvitation(invitation.id, notificationId ?? undefined)
        : await declineRoomInvitation(invitation.id, notificationId ?? undefined);
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        onClose(true);
        router.refresh();
        return;
      }
      onClose(true);
      if (accept && "roomId" in result && result.roomId) {
        toast.success(`הצטרפת לחדר ${invitation.room_name}`);
        router.push(`/rooms/${result.roomId}`);
      } else {
        toast.success("ההזמנה נדחתה");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={!!invitation} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="gap-5 rounded-[24px] p-6 sm:max-w-[420px]">
        {invitation && (
          <>
            <DialogHeader className="items-center text-center">
              <PersonAvatar
                id={invitation.inviter_id}
                name={invitation.inviter_name}
                avatarPath={invitation.inviter_avatar_url}
                ring
                className="mb-1 size-16 text-xl"
              />
              <DialogTitle className="text-xl font-extrabold">
                {invitation.inviter_name} מזמין/ה אותך ללמוד יחד
              </DialogTitle>
              <DialogDescription>
                לחדר <b className="text-foreground">„{invitation.room_name}“</b>
                {invitation.room_topic ? ` · ${invitation.room_topic}` : ""}
              </DialogDescription>
            </DialogHeader>
            <p className="flex items-center justify-center gap-2 rounded-[14px] bg-primary-tint px-4 py-2.5 text-sm font-semibold text-primary-strong">
              <BookOpenIcon className="size-4 shrink-0" aria-hidden />
              {invitation.course_name}
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="brand"
                size="xl"
                className="w-full"
                disabled={pending}
                onClick={() => answer(true)}
              >
                אישור והצטרפות לחדר
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="quiet" disabled={pending} onClick={() => onClose(false)}>
                  לא עכשיו
                </Button>
                <Button
                  variant="quiet"
                  className="text-rose-ink"
                  disabled={pending}
                  onClick={() => answer(false)}
                >
                  דחייה
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
