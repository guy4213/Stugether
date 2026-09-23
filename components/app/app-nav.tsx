"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { signOutAndRedirect } from "@/lib/auth/session-actions";

const NAV_LINKS = [
  { href: "/dashboard", label: "דשבורד" },
  { href: "/courses", label: "קורסים" },
  { href: "/analytics", label: "התקדמות" },
  { href: "/notifications", label: "התראות" },
  { href: "/profile", label: "פרופיל" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border/60 bg-card/40">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="text-lg font-bold text-primary">
          StuGether
        </Link>

        <ul className="hidden items-center gap-1 text-sm font-medium sm:flex">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <form action={signOutAndRedirect}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOutIcon data-icon="inline-start" />
            התנתקות
          </Button>
        </form>
      </nav>
    </header>
  );
}
