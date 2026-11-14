"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { NAV_LINKS, isLinkActive } from "@/components/app/app-nav";

// A room or a private chat keeps its message box at the bottom of the
// screen, so the bar steps aside there.
const HIDDEN_ON = [/^\/rooms\/[^/]+/, /^\/messages\/[^/]+/];

// Phones and tablets (below lg): the five main tabs as icons at the bottom
// of the screen, instead of the old hamburger menu (client QA 11.2026).
// Renders a spacer too, so the end of the page is never hidden behind it.
export function BottomTabBar() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((re) => re.test(pathname))) return null;

  return (
    <>
      <div aria-hidden className="h-[calc(64px+env(safe-area-inset-bottom))] shrink-0 lg:hidden" />
      <nav
        aria-label="ניווט ראשי"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#edf0f5] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,27,51,.06)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-xl items-stretch">
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <li key={link.href} className="flex-1">
                <Link
                  href={link.href}
                  aria-label={link.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground active:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      active && "bg-primary-soft",
                    )}
                  >
                    <link.icon
                      className="size-[22px]"
                      strokeWidth={active ? 2.2 : 1.8}
                      aria-hidden
                    />
                  </span>
                  <span className={cn(active && "font-bold")}>{link.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
