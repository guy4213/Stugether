import Link from "next/link";
import { SectionHeader } from "@/components/dashboard/section-header";
import type { DashboardData } from "@/lib/dashboard/queries";

// Side column of the dashboard: general numbers. ("ההתקדמות שלי" moved to
// progress-card.tsx, a client carousel.)

export function InfoTiles({
  stats,
  pendingInvitations,
}: {
  stats: DashboardData["stats"];
  pendingInvitations: number;
}) {
  // RTL: the first tile is the top-right one.
  const tiles = [
    { label: "חדרים פעילים", value: stats.activeRooms, href: "#my-rooms" },
    { label: "קורסים פעילים", value: stats.activeCourses, href: "/courses" },
    { label: "הזמנות ממתינות", value: pendingInvitations, href: "/notifications" },
    { label: "שותפים ללמידה", value: stats.partners, href: "/students" },
  ];

  return (
    <section aria-labelledby="general-info" className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader id="general-info" title="מידע כללי" />
      <ul className="grid flex-1 grid-cols-2 gap-3">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="flex h-full min-h-[104px] flex-col items-center justify-center gap-1 rounded-[18px] border border-border bg-card p-4 text-center shadow-card-sm transition-colors hover:border-primary-line"
            >
              <span className="text-[32px] leading-none font-extrabold text-primary">
                {t.value}
              </span>
              <span className="text-[13px] text-muted-foreground">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
