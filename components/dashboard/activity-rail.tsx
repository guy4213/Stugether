import Link from "next/link";
import { BellIcon, CalendarDaysIcon, ChevronLeftIcon, StarIcon, UsersIcon } from "lucide-react";
import { cn } from "cn";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { JoinRoomButton } from "@/components/rooms/join-room-button";
import { initials, personTone } from "@/lib/ui/people";
import { eventDayLabelHe, relativeTimeHe, timeHe } from "@/lib/ui/format";
import type { ActivityItem, DashboardData } from "@/lib/dashboard/queries";

function ActivityIcon({ item }: { item: ActivityItem }) {
  const ring = item.joinRoomId ? "shadow-[0_0_0_2px_#10B981]" : "";
  if (item.actor) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full border-3 border-white text-sm font-bold",
          personTone(item.actor.id),
          ring,
        )}
      >
        {initials(item.actor.name)}
      </span>
    );
  }
  const Icon =
    item.type === "event_scheduled"
      ? CalendarDaysIcon
      : item.type === "course_recommendation"
        ? StarIcon
        : item.type === "system"
          ? BellIcon
          : UsersIcon;
  return (
    <span
      aria-hidden
      className="flex size-11 shrink-0 items-center justify-center rounded-full border-3 border-white bg-primary-tint text-primary"
    >
      <Icon className="size-[18px]" strokeWidth={2} />
    </span>
  );
}

// Right rail of the dashboard: the latest notifications as a timeline and the
// next course event as a gradient card.
export function ActivityRail({
  activity,
  unreadCount,
  nextEvent,
}: {
  activity: ActivityItem[];
  unreadCount: number;
  nextEvent: DashboardData["nextEvent"];
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-1.5 rounded-[20px] border border-border bg-card p-[22px] xl:w-[340px]">
      <div className="flex items-center justify-between pb-2.5">
        <h2 className="text-xl font-extrabold">פעילות אחרונה</h2>
        {unreadCount > 0 && (
          <Link
            href="/notifications"
            className="rounded-full bg-primary-tint px-2.5 py-1 text-xs font-bold text-primary-strong"
          >
            {unreadCount} חדשות
          </Link>
        )}
      </div>

      {activity.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">אין פעילות חדשה</p>
      ) : (
        <ol className="relative flex flex-col">
          <span
            aria-hidden
            className="absolute top-[22px] right-[21px] bottom-[22px] w-0.5 bg-divider"
          />
          {activity.map((item) => (
            <li key={item.id} className="relative flex gap-3 py-2.5">
              <ActivityIcon item={item} />
              <div className="flex min-w-0 grow flex-col gap-0.5">
                <span className="text-sm font-semibold">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  {relativeTimeHe(item.createdAt)}
                </span>
              </div>
              {item.joinRoomId && (
                <JoinRoomButton
                  roomId={item.joinRoomId}
                  variant="solid"
                  className="h-[34px] self-center rounded-[10px] px-3.5 text-[13px]"
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {nextEvent && (
        <Link
          href={`/courses/${nextEvent.courseId}`}
          className="mt-3 flex flex-col gap-3 rounded-2xl bg-[linear-gradient(135deg,#1d4ed8,#0d9488)] p-4 text-white shadow-[0_14px_28px_-14px_rgba(29,78,216,.6)] transition-transform hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 rounded-full bg-white/18 px-2.5 py-1 text-[13px] font-semibold">
              <CalendarDaysIcon className="size-3.5" strokeWidth={2.2} aria-hidden />
              {eventDayLabelHe(nextEvent.dueAt)}
            </span>
            <ChevronLeftIcon className="size-5" strokeWidth={2.2} aria-hidden />
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-4xl leading-none font-extrabold tracking-[-1px]">
                {timeHe(nextEvent.dueAt)}
              </span>
              <span className="truncate text-[15px] font-semibold">{nextEvent.title}</span>
            </div>
            {nextEvent.registeredCount > 0 && (
              <span className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
                <AvatarStack
                  people={nextEvent.registered}
                  max={3}
                  size="sm"
                  borderClassName="border-[#1E5BC6]"
                />
                {nextEvent.registeredCount} רשומים
              </span>
            )}
          </div>
        </Link>
      )}
    </aside>
  );
}
