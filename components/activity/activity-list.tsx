import Link from "next/link";
import {
  CalendarClockIcon,
  DoorOpenIcon,
  HeartHandshakeIcon,
  MailIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { JoinRoomButton } from "@/components/rooms/join-room-button";
import { relativeTimeHe } from "@/lib/ui/format";
import type { Tone } from "@/lib/ui/tones";
import type { CourseActivityItem } from "@/lib/activity/queries";
import type { CourseActivityKind } from "@/lib/repositories/activity";

const KIND: Record<CourseActivityKind, { icon: LucideIcon; tone: Tone }> = {
  room_opened: { icon: DoorOpenIcon, tone: "violet" },
  session_scheduled: { icon: CalendarClockIcon, tone: "warning" },
  course_joined: { icon: UserPlusIcon, tone: "success" },
  friend_added: { icon: HeartHandshakeIcon, tone: "rose" },
  invited: { icon: MailIcon, tone: "blue" },
};

// One line of "פעילות אחרונה" (dashboard rail and /activity): who did what,
// in which course, when — and "הצטרפות" for an open room with a seat.
export function ActivityList({
  items,
  avatars = false,
}: {
  items: CourseActivityItem[];
  /** The full page shows the person's avatar next to the kind icon. */
  avatars?: boolean;
}) {
  return (
    <ol className="divide-y divide-divider">
      {items.map((item) => {
        const { icon: Icon, tone } = KIND[item.kind];
        const body = (
          <>
            <span className="relative shrink-0">
              {avatars ? (
                <>
                  <PersonAvatar
                    id={item.actor.id}
                    name={item.actor.name}
                    avatarPath={item.actor.avatarPath}
                    className="size-11"
                  />
                  <IconTile
                    tone={tone}
                    className="absolute -end-1 -bottom-1 size-5 rounded-full border-2 border-white [&_svg]:size-3"
                  >
                    <Icon strokeWidth={2.4} />
                  </IconTile>
                </>
              ) : (
                <IconTile tone={tone} className="size-10 rounded-[12px] [&_svg]:size-[18px]">
                  <Icon strokeWidth={2} />
                </IconTile>
              )}
            </span>
            <span className="flex min-w-0 grow flex-col">
              <span className="line-clamp-2 text-sm font-bold">{item.title}</span>
              {item.subtitle && (
                <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
              )}
            </span>
          </>
        );
        return (
          <li key={item.id} className="flex items-center gap-3 py-3">
            {item.href ? (
              <Link
                prefetch={false}
                href={item.href}
                className="flex min-w-0 grow items-center gap-3 rounded-lg hover:text-primary"
              >
                {body}
              </Link>
            ) : (
              <span className="flex min-w-0 grow items-center gap-3">{body}</span>
            )}
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {item.joinRoomId ? (
                <JoinRoomButton
                  roomId={item.joinRoomId}
                  variant="solid"
                  className="h-8 rounded-[10px] px-3 text-[12px]"
                />
              ) : (
                <span suppressHydrationWarning>{relativeTimeHe(item.at)}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
