import Link from "next/link";
import { redirect } from "next/navigation";
import { BellIcon, BellOffIcon } from "lucide-react";
import { cn } from "cn";
import { NotificationRow } from "@/components/notifications/notification-row";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { getCurrentUser } from "@/lib/auth/session";
import {
  NOTIFICATION_CATEGORIES,
  getNotificationsData,
  parseNotificationCategory,
} from "@/lib/notifications/queries";
import type { NotificationCategory } from "@/lib/repositories/notifications";
import { shortDateHe, timeHe } from "@/lib/ui/format";

// Per the client's notes: "ROOMS instead of GROUPS, remove LESSONS" — the
// mockup's שיעורים/קבוצות tabs become הזמנות/חדרים here.
const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  invitations: "הזמנות",
  rooms: "חדרים",
  courses: "קורסים",
  system: "מערכת",
};

// "התראות" per Notifications.dc.html.
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const category = parseNotificationCategory((await searchParams).category);
  const data = await getNotificationsData(user.id, category);
  const weekMax = Math.max(1, ...Object.values(data.week.byCategory));

  const timeLabel = (groupIndex: string, iso: string) =>
    groupIndex === "היום" ? timeHe(iso) : groupIndex === "אתמול" ? "אתמול" : shortDateHe(iso);

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 pt-7 pb-10 sm:px-8 xl:flex-row xl:items-start xl:px-12"
    >
      <section className="flex min-w-0 grow flex-col gap-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.5px] sm:text-[38px]">
              התראות
            </h1>
            {data.unread > 0 && (
              <span className="flex h-[30px] items-center rounded-full bg-brand px-3 text-[13px] font-bold text-white">
                {data.unread} חדשות
              </span>
            )}
          </div>
          <MarkAllReadButton disabled={data.unread === 0} />
        </div>

        <nav
          aria-label="סינון התראות"
          className="flex gap-1.5 self-start overflow-x-auto rounded-2xl border border-border bg-white p-[5px]"
        >
          <CategoryTab href="/notifications" active={category === null} count={data.counts.all}>
            הכל
          </CategoryTab>
          {NOTIFICATION_CATEGORIES.map((c) => (
            <CategoryTab
              key={c}
              href={`/notifications?category=${c}`}
              active={category === c}
              count={data.counts[c]}
            >
              {CATEGORY_LABEL[c]}
            </CategoryTab>
          ))}
        </nav>

        <div className="overflow-hidden rounded-[22px] border border-border bg-white shadow-card">
          {data.groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-muted-foreground">
              <BellOffIcon className="size-8" aria-hidden />
              <p>אין התראות{category ? ` ב${CATEGORY_LABEL[category]}` : ""}</p>
            </div>
          ) : (
            data.groups.map((group, gi) => (
              <section key={group.label} aria-label={group.label}>
                <h2
                  className={cn(
                    "px-5 pt-3.5 pb-1.5 text-[13px] font-bold text-muted-foreground sm:px-7",
                    gi > 0 && "border-t border-divider",
                  )}
                >
                  {group.label}
                </h2>
                <ul>
                  {group.items.map((item, i) => (
                    <li key={item.id} className={cn(i > 0 && "border-t border-divider")}>
                      <NotificationRow item={item} time={timeLabel(group.label, item.created_at)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </section>

      <aside className="flex w-full shrink-0 flex-col gap-4 pt-1 xl:w-[380px]">
        <div className="relative flex flex-col gap-[18px] overflow-hidden rounded-[22px] bg-brand-deep p-6 text-white shadow-[0_18px_36px_-20px_rgba(29,78,216,.7)]">
          <span aria-hidden className="absolute -top-20 -left-[60px] size-[180px] rounded-full bg-white/8" />
          <div className="relative flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-white/85">השבוע</span>
              <span className="text-xl font-bold">
                {data.week.total === 1 ? "התראה אחת" : `${data.week.total} התראות`}
              </span>
            </div>
            <span className="flex size-12 items-center justify-center rounded-[15px] bg-white/18">
              <BellIcon className="size-[22px]" strokeWidth={2} aria-hidden />
            </span>
          </div>
          <ul className="relative flex flex-col gap-2.5">
            {NOTIFICATION_CATEGORIES.map((c) => (
              <li key={c} className="flex items-center gap-2.5 text-sm">
                <span className="w-16">{CATEGORY_LABEL[c]}</span>
                <span className="h-2 grow overflow-hidden rounded bg-white/20" aria-hidden>
                  <span
                    className="block h-full rounded bg-white"
                    style={{ width: `${(data.week.byCategory[c] / weekMax) * 100}%` }}
                  />
                </span>
                <span className="w-4 font-bold">{data.week.byCategory[c]}</span>
              </li>
            ))}
          </ul>
        </div>

        <NotificationPreferences preferences={data.preferences} />
      </aside>
    </main>
  );
}

function CategoryTab({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={cn(
        "flex h-[38px] shrink-0 items-center gap-2 rounded-[11px] px-4 text-sm",
        active ? "bg-brand font-bold text-white" : "font-medium text-ink-2 hover:bg-muted",
      )}
    >
      {children}
      <span
        className={cn(
          "rounded-full px-[7px] py-px text-xs",
          active ? "bg-white/25" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
