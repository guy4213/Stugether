import { CalendarClockIcon } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { SectionHeader } from "@/components/dashboard/section-header";
import { ActivityList } from "@/components/activity/activity-list";
import { eventDayLabelHe, timeHe } from "@/lib/ui/format";
import { NEXT_EVENT_LABEL } from "@/lib/ui/labels";
import type { DashboardData } from "@/lib/dashboard/queries";
import type { CourseActivityItem } from "@/lib/activity/queries";

// "פעילות אחרונה" (SPEC §4.2; client QA 12.11.2026): the latest activity in my
// courses and rooms (the same feed as /activity, which "כל הפעילות" opens —
// it used to open the personal notifications) + the next course event.
export function ActivityRail({
  items,
  nextEvent,
}: {
  items: CourseActivityItem[];
  nextEvent: DashboardData["nextEvent"];
}) {
  const empty = items.length === 0 && !nextEvent;
  return (
    <section aria-labelledby="recent-activity" className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        id="recent-activity"
        title="פעילות אחרונה"
        link={{ href: "/activity", label: "כל הפעילות", chevron: true }}
      />
      <div className="flex-1 rounded-[20px] border border-border bg-card px-4 py-1 shadow-card-sm">
        {empty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">אין פעילות חדשה</p>
        ) : (
          <>
            {items.length > 0 && <ActivityList items={items} />}
            {nextEvent && (
              <div className="flex items-center gap-3 border-t border-divider py-3 first:border-t-0">
                <IconTile tone="blue" className="size-10 rounded-[12px] [&_svg]:size-[18px]">
                  <CalendarClockIcon strokeWidth={2} />
                </IconTile>
                <div className="flex min-w-0 grow flex-col">
                  <span className="truncate text-sm font-bold">
                    {NEXT_EVENT_LABEL[nextEvent.kind]}: {nextEvent.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {nextEvent.courseName}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {eventDayLabelHe(nextEvent.dueAt)} {timeHe(nextEvent.dueAt)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
