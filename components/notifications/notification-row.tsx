"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  CalendarCheckIcon,
  MailIcon,
  StarIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { JoinRoomButton } from "@/components/rooms/join-room-button";
import {
  acceptRoomInvitation,
  declineRoomInvitation,
  markNotificationRead,
} from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/notifications/queries";
import type { NotificationType } from "@/lib/repositories/notifications";

const TYPE_ICON: Record<NotificationType, { icon: LucideIcon; tile: string; filled?: boolean }> = {
  event_scheduled: {
    icon: CalendarCheckIcon,
    tile: "bg-brand-diag text-white shadow-[0_8px_16px_-8px_rgba(37,99,235,.6)]",
  },
  room_invitation: { icon: MailIcon, tile: "bg-violet-soft text-violet" },
  room_opened: { icon: UsersIcon, tile: "bg-primary-tint text-primary" },
  room_joined: { icon: UserPlusIcon, tile: "bg-rose-soft text-rose" },
  course_recommendation: { icon: StarIcon, tile: "bg-warning-soft text-warning", filled: true },
  system: { icon: BellIcon, tile: "bg-success-soft text-secondary", filled: true },
};

// One notification row (Notifications.dc.html): tinted icon tile, title +
// body, the action that fits its type, time, and an unread dot / accent bar.
export function NotificationRow({ item, time }: { item: NotificationItem; time: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = item.read_at === null;
  const meta = TYPE_ICON[item.type];
  const Icon = meta.icon;

  function markRead() {
    if (!unread) return;
    startTransition(async () => {
      await markNotificationRead(item.id);
    });
  }

  function respond(accept: boolean) {
    if (item.action?.kind !== "invitation") return;
    const invitationId = item.action.invitation.id;
    startTransition(async () => {
      const result = accept
        ? await acceptRoomInvitation(invitationId, item.id)
        : await declineRoomInvitation(invitationId, item.id);
      if (!result.ok) {
        toast.error(result.error ?? "משהו השתבש");
        return;
      }
      if (accept && "roomId" in result && result.roomId) router.push(`/rooms/${result.roomId}`);
    });
  }

  return (
    <div
      className={cn(
        "relative flex flex-wrap items-center gap-4 px-5 py-4 sm:flex-nowrap sm:px-7",
        unread && "bg-unread",
      )}
    >
      {unread && (
        <span
          aria-hidden
          className="absolute top-3 right-0 bottom-3 w-1 rounded-l bg-[linear-gradient(180deg,#2563eb,#0d9488)]"
        />
      )}
      <span
        aria-hidden
        className={cn("flex size-[50px] shrink-0 items-center justify-center rounded-2xl", meta.tile)}
      >
        <Icon className="size-[22px]" strokeWidth={2} fill={meta.filled ? "currentColor" : "none"} />
      </span>
      <div className="flex min-w-0 grow basis-40 flex-col gap-[3px]">
        <span className={cn("text-base", unread ? "font-bold" : "font-semibold")}>
          {item.title}
          {unread && <span className="sr-only"> (חדשה)</span>}
        </span>
        {item.body && (
          <span className={cn("text-sm", unread ? "text-ink-2" : "text-muted-foreground")}>
            {item.body}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.action?.kind === "invitation" && (
          <>
            <Button
              variant="outline-primary"
              size="chip"
              disabled={pending}
              onClick={() => respond(true)}
            >
              אישור
            </Button>
            <Button variant="quiet" size="chip" disabled={pending} onClick={() => respond(false)}>
              דחייה
            </Button>
          </>
        )}
        {item.action?.kind === "join" && (
          <JoinRoomButton roomId={item.action.roomId} variant="outline-primary" size="chip" />
        )}
        {item.action?.kind === "room" && (
          <Button asChild variant="soft" size="chip">
            <Link href={`/rooms/${item.action.roomId}`} onClick={markRead}>
              לחדר
            </Link>
          </Button>
        )}
        {item.action?.kind === "course" && (
          <Button asChild variant={item.type === "event_scheduled" ? "outline-primary" : "soft"} size="chip">
            <Link href={`/courses/${item.action.courseId}`} onClick={markRead}>
              {item.action.label}
            </Link>
          </Button>
        )}
      </div>

      <div className="flex w-[76px] shrink-0 flex-col items-end gap-1.5">
        <span className="text-[13px] text-muted-foreground">{time}</span>
        {unread && (
          <button
            type="button"
            onClick={markRead}
            disabled={pending}
            aria-label="סימון כנקרא"
            title="סימון כנקרא"
            className="flex size-5 items-center justify-center rounded-full"
          >
            <span className="size-[9px] rounded-full bg-primary" />
          </button>
        )}
      </div>
    </div>
  );
}
