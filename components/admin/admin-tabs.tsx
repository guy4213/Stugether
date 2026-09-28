"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const TABS = [
  { href: "/admin", label: "סקירה" },
  { href: "/admin/users", label: "משתמשים" },
  { href: "/admin/catalog", label: "קטלוג" },
  { href: "/admin/rooms", label: "חדרים" },
  { href: "/admin/ai", label: "עוזר AI" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="ניווט ניהול"
      className="flex gap-1.5 self-start overflow-x-auto rounded-2xl border border-border bg-white p-[5px]"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-[38px] shrink-0 items-center rounded-[11px] px-4 text-sm",
              active ? "bg-brand font-bold text-white" : "font-medium text-ink-2 hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
