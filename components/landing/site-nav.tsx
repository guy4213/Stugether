"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

const AQUA_BUTTON =
  "flex h-11 items-center rounded-[13px] bg-[linear-gradient(90deg,#2dd4bf,#38bdf8)] px-[22px] text-[15px] font-bold whitespace-nowrap text-[#06244a] shadow-[0_10px_24px_-10px_rgba(45,212,191,.8)] hover:brightness-105";

// Transparent public nav that sits inside the landing hero (Landing.dc.html).
export function SiteNav({ isAuthed }: { isAuthed: boolean }) {
  return (
    <header className="relative z-20">
      <nav
        aria-label="ניווט ראשי"
        className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 md:px-10 xl:px-16"
      >
        <div className="flex items-center gap-12">
          <Link href="/" aria-label="StuGether — דף הבית" className="rounded-lg">
            <Logo variant="inverse" size={36} className="[&>span]:text-[25px]" />
          </Link>
          <ul className="hidden items-center gap-8 text-[15px] font-medium lg:flex">
            {NAV_LINKS.map((link, i) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={i === 0 ? "page" : undefined}
                  className={i === 0 ? "text-white" : "text-white/80 hover:text-white"}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2.5">
          {isAuthed ? (
            <Link href="/dashboard" className={AQUA_BUTTON}>
              לדשבורד
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-11 items-center rounded-[13px] border-[1.5px] border-white/40 px-5 text-[15px] font-semibold text-white hover:bg-white/10 sm:flex"
              >
                התחברות
              </Link>
              <Link href="/signup" className={AQUA_BUTTON}>
                הרשמה חינם
              </Link>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="תפריט ניווט"
              className="flex size-11 items-center justify-center rounded-xl text-white outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/60 lg:hidden"
            >
              <MenuIcon className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {NAV_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link href={link.href}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
              {!isAuthed && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/login">התחברות</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
