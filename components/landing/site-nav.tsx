"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Only real destinations — the mockup's Lessons/Groups/Universities pages
// don't exist in this product, so they'd be dead links in a demo.
const NAV_LINKS = [
  { href: "/", label: "בית" },
  { href: "/#features", label: "מה יש כאן" },
  { href: "/#how", label: "איך זה עובד" },
  { href: "/courses", label: "קורסים" },
] as const;

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <nav
        aria-label="ניווט ראשי"
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6"
      >
        <Link href="/" className="text-2xl font-bold text-primary">
          StuGether
        </Link>

        <ul className="hidden items-center gap-8 text-sm font-medium text-foreground/80 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="transition-colors hover:text-primary">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="תפריט ניווט">
                <MenuIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {NAV_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            asChild
            variant="outline"
            className="h-9 rounded-full border-primary px-5 text-primary hover:bg-primary/5"
          >
            <Link href="/login">התחברות</Link>
          </Button>
          <Button asChild variant="gradient" className="h-9 px-5">
            <Link href="/signup">הרשמה</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
