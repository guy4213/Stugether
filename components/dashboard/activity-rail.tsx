import type { ReactNode } from "react";
import {
  BellIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  MailIcon,
  MessageSquareIcon,
  UsersIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { JoinRoomButton } from "@/components/rooms/join-room-button";
import { SectionHeader } from "@/components/dashboard/section-header";
import type { NotificationType } from "@/lib/repositories/notifications";
import type { Tone } from "@/lib/ui/tones";
import { eventDayLabelHe, relativeTimeHe, timeHe } from "@/lib/ui/format";
import { NEXT_EVENT_LABEL } from "@/lib/ui/labels";
import type { ActivityItem, DashboardData } from "@/lib/dashboard/queries";

const TYPE_ICON: Record<NotificationType, { icon: LucideIcon; tone: Tone }> = {
  room_invitation: { icon: MailIcon, tone: "violet" },
  room_opened: { icon: VideoIcon, tone: "violet" },
  room_joined: { icon: UsersIcon, tone: "success" },
  room_join_request: { icon: UsersIcon, tone: "success" },
  room_join_decided: { icon: CircleCheckIcon, tone: "blue" },
  event_scheduled: { icon: CalendarDaysIcon, tone: "warning" },
  session_proposed: { icon: CalendarDaysIcon, tone: "warning" },
  session_scheduled: { icon: CalendarClockIcon, tone: "warning" },
  direct_message: { icon: MessageSquareIcon, tone: "blue" },
  course_recommendation: { icon: CircleCheckIcon, tone: "blue" },
  system: { icon: BellIcon, tone: "rose" },
};

function Row({
  icon: Icon,
  tone,
  title,
  subtitle,
  end,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  subtitle: string | null;
  end: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <IconTile tone={tone} className="size-10 rounded-[12px] [&_svg]:size-[18px]">
        <Icon strokeWidth={2} />
      </IconTile>
      <div className="flex min-w-0 grow flex-col">
        <span className="truncate text-sm font-bold">{title}</span>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">{end}</span>
    </li>
  );
}

// "פעילות אחרונה" (SPEC §4.2): the latest notifications + the next course event.
export function ActivityRail({
  activity,
  nextEvent,
}: {
  activity: ActivityItem[];
  nextEvent: DashboardData["nextEvent"];
}) {
  const empty = activity.length === 0 && !nextEvent;
  return (
    <section aria-labelledby="recent-activity" className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        id="recent-activity"
        title="פעילות אחרונה"
        link={{ href: "/notifications", label: "כל ההיסטוריה", chevron: true }}
      />
      <div className="flex-1 rounded-[20px] border border-border bg-card px-4 py-1 shadow-card-sm">
        {empty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">אין פעילות חדשה</p>
        ) : (
          <ol className="divide-y divide-divider">
            {activity.map((item) => {
              const { icon, tone } = TYPE_ICON[item.type] ?? TYPE_ICON.system;
              return (
                <Row
                  key={item.id}
                  icon={item.type === "system" && item.actor ? MessageSquareIcon : icon}
                  tone={tone}
                  title={item.title}
                  subtitle={item.body}
                  end={
                    item.joinRoomId ? (
                      <JoinRoomButton
                        roomId={item.joinRoomId}
                        variant="solid"
                        className="h-8 rounded-[10px] px-3 text-[12px]"
                      />
                    ) : (
                      relativeTimeHe(item.createdAt)
                    )
                  }
                />
              );
            })}
            {nextEvent && (
              <Row
                icon={CalendarClockIcon}
                tone="blue"
                title={`${NEXT_EVENT_LABEL[nextEvent.kind]}: ${nextEvent.title}`}
                subtitle={nextEvent.courseName}
                end={`${eventDayLabelHe(nextEvent.dueAt)} ${timeHe(nextEvent.dueAt)}`}
              />
            )}
          </ol>
        )}
      </div>
    </section>
  );
}
