"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellIcon,
  BookOpenIcon,
  ChartColumnIcon,
  HouseIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/brand/logo";
import { LiveDot } from "@/components/ui/live-dot";
import { PersonAvatar } from "@/components/ui/person-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAndRedirect } from "@/lib/auth/session-actions";

const NAV_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "בית", icon: HouseIcon },
  { href: "/courses", label: "קורסים", icon: BookOpenIcon },
  { href: "/analytics", label: "ההתקדמות שלי", icon: ChartColumnIcon },
  { href: "/notifications", label: "התראות", icon: BellIcon },
  { href: "/profile", label: "הגדרות פרופיל", icon: UserIcon },
];

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type ShellProps = {
  userId: string;
  fullName: string;
  avatarPath: string | null;
  unreadNotifications: number;
  activeRoomId: string | null;
};

function NavBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="h-5 min-w-5 rounded-[10px] bg-primary px-1.5 text-center text-[11px] leading-5 font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        router.push(q ? `/courses?q=${encodeURIComponent(q)}` : "/courses");
      }}
    >
      <label className="flex h-11 w-60 items-center gap-2.5 rounded-[14px] border border-border bg-muted px-3.5 text-muted-foreground focus-within:border-primary-line">
        <SearchIcon className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
        <input
          type="search"
          name="q"
          aria-label="חיפוש"
          placeholder="חיפוש קורסים, חדרים וסיכומים"
          className="min-w-0 grow border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
    </form>
  );
}

// Top nav per TopNav.dc.html. Desktop (lg+): logo, segmented nav, search,
// "active room" pill, avatar menu. Below lg: logo + avatar + menu button.
export function AppNav(props: ShellProps) {
  const pathname = usePathname();

  const avatarMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`פרופיל: ${props.fullName}`}
        className="flex h-11 items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PersonAvatar
          id={props.userId}
          name={props.fullName}
          avatarPath={props.avatarPath}
          ring
          online
          className="size-10"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{props.fullName}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon />
            הגדרות פרופיל
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild variant="destructive">
          <form action={signOutAndRedirect} className="w-full">
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOutIcon className="size-4" />
              התנתקות
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/92 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-8 xl:px-12">
        <div className="flex items-center gap-7">
          <Link href="/dashboard" aria-label="StuGether — דף הבית" className="rounded-lg">
            <Logo />
          </Link>

          <nav
            aria-label="ניווט ראשי"
            className="hidden items-center gap-1 rounded-2xl bg-muted p-[5px] lg:flex"
          >
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-xl px-3.5 text-[15px] whitespace-nowrap transition-colors",
                    active
                      ? "bg-white font-semibold text-primary-strong shadow-soft"
                      : "font-medium text-muted-foreground hover:text-foreground",
                  )}
                >
                  <link.icon className="size-[18px]" strokeWidth={active ? 2 : 1.9} aria-hidden />
                  {link.label}
                  {link.href === "/notifications" && (
                    <NavBadge count={props.unreadNotifications} />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <SearchBox className="hidden xl:block" />
          {props.activeRoomId && (
            <Link
              href={`/rooms/${props.activeRoomId}`}
              className="hidden h-11 items-center gap-2 rounded-[14px] bg-success-soft px-3.5 text-[13px] font-semibold text-success-ink hover:bg-[#d8f3ea] sm:flex"
            >
              <LiveDot className="size-2.5" />
              חדר פעיל
            </Link>
          )}
          {avatarMenu}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="תפריט ניווט"
              className="relative flex size-11 items-center justify-center rounded-xl text-foreground hover:bg-muted lg:hidden"
            >
              <MenuIcon className="size-5" />
              {props.unreadNotifications > 0 && (
                <span className="absolute top-2 right-2 size-2 rounded-full bg-primary" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {NAV_LINKS.map((link) => {
                const active = isLinkActive(pathname, link.href);
                return (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(active && "bg-primary-soft font-semibold text-primary-strong")}
                    >
                      <link.icon />
                      <span className="grow">{link.label}</span>
                      {link.href === "/notifications" && (
                        <NavBadge count={props.unreadNotifications} />
                      )}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              {props.activeRoomId && (
                <DropdownMenuItem asChild>
                  <Link href={`/rooms/${props.activeRoomId}`} className="text-success-ink">
                    <LiveDot />
                    חדר פעיל
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
