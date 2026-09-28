import {
  ActivityIcon,
  AlertTriangleIcon,
  MessageSquareIcon,
  SparklesIcon,
  UsersIcon,
  DoorOpenIcon,
} from "lucide-react";
import { StatTile } from "@/components/admin/stat-tile";
import { getAdminOverview } from "@/lib/admin/queries";

const nf = new Intl.NumberFormat("he-IL");

// "סטטיסטיקות" (SPEC §4.9): registered users, active in 7 days, rooms,
// messages, AI runs. Counts only — admin_global_stats never returns content.
export default async function AdminOverviewPage() {
  const { stats, usage } = await getAdminOverview();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="משתמשים רשומים" value={nf.format(stats.usersTotal)} icon={UsersIcon} />
        <StatTile
          label="פעילים ב-7 ימים"
          value={nf.format(stats.usersActive7d)}
          icon={ActivityIcon}
          tone="success"
        />
        <StatTile
          label="חדרים"
          value={nf.format(stats.roomsTotal)}
          hint={`${nf.format(stats.roomsActive)} פעילים`}
          icon={DoorOpenIcon}
          tone="violet"
        />
        <StatTile
          label="הודעות"
          value={nf.format(stats.messagesTotal)}
          icon={MessageSquareIcon}
          tone="sky"
        />
        <StatTile
          label="ריצות AI"
          value={nf.format(stats.aiRunsTotal)}
          hint={`${nf.format(usage.runs)} ב-30 הימים האחרונים`}
          icon={SparklesIcon}
          tone="teal"
        />
        <StatTile
          label="ריצות AI שנכשלו"
          value={nf.format(stats.aiRunsFailed)}
          icon={AlertTriangleIcon}
          tone="rose"
        />
      </div>
    </div>
  );
}
