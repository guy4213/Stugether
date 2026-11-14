import Link from "next/link";
import {
  ActivityIcon,
  CoinsIcon,
  DoorOpenIcon,
  DownloadIcon,
  MessageSquareIcon,
  SparklesIcon,
  UserPlusIcon,
} from "lucide-react";
import { cn } from "cn";
import { CourseActivityBars } from "@/components/admin/course-activity-bars";
import { StatTile } from "@/components/admin/stat-tile";
import { UsageBarChart, dayLabel } from "@/components/admin/usage-bar-chart";
import { UsageHeatmap } from "@/components/admin/usage-heatmap";
import { USAGE_PERIODS, getAdminUsage, parseUsagePeriod } from "@/lib/admin/queries";

const nf = new Intl.NumberFormat("he-IL");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const TH = "px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground";
const TD = "px-4 py-2.5 tabular-nums";

// Change vs the previous period of the same length, e.g. "+12% לעומת התקופה הקודמת".
function versus(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "חדש — לא היה בתקופה הקודמת" : "כמו בתקופה הקודמת";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "כמו בתקופה הקודמת";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% לעומת התקופה הקודמת`;
}

const joinHints = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" · ");

// "שימוש" (SPEC §4.9, CR 11.11.2026 + 14.11.2026): how the product is used
// over 7/30/90 days — active users, signups, messages, rooms, AI runs and cost
// vs the previous period, per day, per course / user and by weekday x hour,
// plus an Excel export. Counts only, never message content.
export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = parseUsagePeriod(params.days);
  const usage = await getAdminUsage(days);
  const { totals, previous } = usage;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="תקופה" className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">תקופה:</span>
          {USAGE_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/usage?days=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={cn(
                "flex h-[34px] items-center rounded-[11px] border px-3.5 text-[13px]",
                p === days
                  ? "border-brand bg-brand font-bold text-white"
                  : "border-border bg-white font-medium hover:bg-muted",
              )}
            >
              {p} ימים
            </Link>
          ))}
        </nav>
        <a
          href={`/admin/usage/export?days=${days}`}
          download
          className="ms-auto flex h-[34px] items-center gap-1.5 rounded-[11px] border border-border bg-white px-3.5 text-[13px] font-semibold hover:bg-muted"
        >
          <DownloadIcon className="size-4" aria-hidden />
          ייצוא ל-Excel
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="משתמשים פעילים"
          value={nf.format(totals.activeUsers)}
          hint="שלחו הודעה או פנו לעוזר"
          icon={ActivityIcon}
          tone="success"
        />
        <StatTile
          label="הצטרפו"
          value={nf.format(totals.signups)}
          hint={versus(totals.signups, previous.signups)}
          icon={UserPlusIcon}
          tone="blue"
        />
        <StatTile
          label="חדרים חדשים"
          value={nf.format(totals.roomsCreated)}
          hint={versus(totals.roomsCreated, previous.roomsCreated)}
          icon={DoorOpenIcon}
          tone="violet"
        />
        <StatTile
          label="הודעות בחדרים"
          value={nf.format(totals.roomMessages)}
          hint={joinHints(
            versus(totals.roomMessages, previous.roomMessages),
            `${nf.format(totals.directMessages)} פרטיות`,
          )}
          icon={MessageSquareIcon}
          tone="sky"
        />
        <StatTile
          label="ריצות AI"
          value={nf.format(totals.aiRuns)}
          hint={joinHints(
            versus(totals.aiRuns, previous.aiRuns),
            totals.aiFailed > 0 && `${nf.format(totals.aiFailed)} נכשלו`,
          )}
          icon={SparklesIcon}
          tone="teal"
        />
        <StatTile
          label="עלות AI מוערכת"
          value={usd.format(totals.costUsd)}
          hint={joinHints(
            versus(totals.costUsd, previous.costUsd),
            `${nf.format(totals.tokens)} טוקנים`,
          )}
          icon={CoinsIcon}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <UsageBarChart
          title="משתמשים פעילים ביום"
          total={`${nf.format(totals.activeUsers)} בתקופה`}
          unit="משתמשים"
          data={usage.daily.map((d) => ({ day: d.day, value: d.activeUsers }))}
        />
        <UsageBarChart
          title="הודעות ביום (חדרים + פרטיות)"
          total={nf.format(totals.roomMessages + totals.directMessages)}
          unit="הודעות"
          data={usage.daily.map((d) => ({ day: d.day, value: d.roomMessages + d.directMessages }))}
        />
        <UsageBarChart
          title="ריצות AI ביום"
          total={nf.format(totals.aiRuns)}
          unit="ריצות"
          data={usage.daily.map((d) => ({ day: d.day, value: d.aiRuns }))}
        />
        <UsageBarChart
          title="עלות AI מוערכת ביום"
          total={usd.format(totals.costUsd)}
          unit=""
          format={(v) => usd.format(v)}
          data={usage.daily.map((d) => ({ day: d.day, value: d.costUsd }))}
        />
        <UsageBarChart
          title="הצטרפויות ביום"
          total={nf.format(totals.signups)}
          unit="משתמשים חדשים"
          data={usage.daily.map((d) => ({ day: d.day, value: d.signups }))}
        />
        <CourseActivityBars courses={usage.topCourses} />
      </div>

      {usage.heatmap ? (
        <UsageHeatmap cells={usage.heatmap} days={days} />
      ) : (
        <p className="rounded-[22px] border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
          מפת &quot;מתי לומדים&quot; עדיין לא זמינה: צריך להריץ את ה-migration{" "}
          <code dir="ltr">20261114000001_admin_usage_heatmap</code>.
        </p>
      )}

      <TableCard title="קורסים מובילים" empty="אין פעילות בקורסים בתקופה">
        {usage.topCourses.length > 0 && (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-divider">
                <th className={TH}>קורס</th>
                <th className={TH}>חדרים חדשים</th>
                <th className={TH}>חדרים פעילים</th>
                <th className={TH}>הודעות</th>
                <th className={TH}>ריצות AI</th>
                <th className={TH}>עלות AI</th>
              </tr>
            </thead>
            <tbody>
              {usage.topCourses.map((c) => (
                <tr key={c.id} className="border-b border-divider last:border-0">
                  <td className="px-4 py-2.5 font-semibold">
                    {c.name}
                    {c.code && (
                      <span className="ms-2 text-xs font-normal text-muted-foreground" dir="ltr">
                        {c.code}
                      </span>
                    )}
                  </td>
                  <td className={TD}>{nf.format(c.roomsCreated)}</td>
                  <td className={TD}>{nf.format(c.activeRooms)}</td>
                  <td className={TD}>{nf.format(c.messages)}</td>
                  <td className={TD}>{nf.format(c.aiRuns)}</td>
                  <td className={TD}>{usd.format(c.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <TableCard title="משתמשים פעילים מובילים" empty="אין פעילות בתקופה">
          {usage.topUsers.length > 0 && (
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="border-b border-divider">
                  <th className={TH}>משתמש/ת</th>
                  <th className={TH}>הודעות בחדרים</th>
                  <th className={TH}>הודעות פרטיות</th>
                  <th className={TH}>ריצות AI</th>
                </tr>
              </thead>
              <tbody>
                {usage.topUsers.map((u) => (
                  <tr key={u.id} className="border-b border-divider last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{u.fullName}</td>
                    <td className={TD}>{nf.format(u.roomMessages)}</td>
                    <td className={TD}>{nf.format(u.directMessages)}</td>
                    <td className={TD}>{nf.format(u.aiRuns)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>

        <TableCard title="צרכני AI מובילים" empty="אין ריצות AI בתקופה">
          {usage.topAiUsers.length > 0 && (
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="border-b border-divider">
                  <th className={TH}>משתמש/ת</th>
                  <th className={TH}>ריצות</th>
                  <th className={TH}>נכשלו</th>
                  <th className={TH}>טוקנים</th>
                  <th className={TH}>עלות</th>
                </tr>
              </thead>
              <tbody>
                {usage.topAiUsers.map((u) => (
                  <tr key={u.id} className="border-b border-divider last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{u.fullName}</td>
                    <td className={TD}>{nf.format(u.aiRuns)}</td>
                    <td className={TD}>{nf.format(u.aiFailed)}</td>
                    <td className={TD}>{nf.format(u.tokens)}</td>
                    <td className={TD}>{usd.format(u.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>
      </div>

      <details className="rounded-[22px] border border-border bg-white shadow-card">
        <summary className="cursor-pointer px-5 py-4 font-bold">נתונים יומיים כטבלה</summary>
        <div className="overflow-x-auto border-t border-divider">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-divider">
                <th className={TH}>יום</th>
                <th className={TH}>פעילים</th>
                <th className={TH}>הצטרפו</th>
                <th className={TH}>הודעות בחדרים</th>
                <th className={TH}>הודעות פרטיות</th>
                <th className={TH}>חדרים חדשים</th>
                <th className={TH}>ריצות AI</th>
                <th className={TH}>נכשלו</th>
                <th className={TH}>עלות AI</th>
              </tr>
            </thead>
            <tbody>
              {[...usage.daily].reverse().map((d) => (
                <tr key={d.day} className="border-b border-divider last:border-0">
                  <td className={TD}>{dayLabel(d.day)}</td>
                  <td className={TD}>{nf.format(d.activeUsers)}</td>
                  <td className={TD}>{nf.format(d.signups)}</td>
                  <td className={TD}>{nf.format(d.roomMessages)}</td>
                  <td className={TD}>{nf.format(d.directMessages)}</td>
                  <td className={TD}>{nf.format(d.roomsCreated)}</td>
                  <td className={TD}>{nf.format(d.aiRuns)}</td>
                  <td className={TD}>{nf.format(d.aiFailed)}</td>
                  <td className={TD}>{usd.format(d.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TableCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-border bg-white shadow-card">
      <h2 className="border-b border-divider px-5 py-4 text-lg font-bold">{title}</h2>
      {children ? (
        <div className="overflow-x-auto">{children}</div>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
