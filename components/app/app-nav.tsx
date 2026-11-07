"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellIcon,
  BookOpenIcon,
  ChartColumnIcon,
  ChevronDownIcon,
  HouseIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareTextIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserIcon,
  UserSearchIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { LogoWordmark } from "@/components/brand/logo";
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

type NavLink = { href: string; label: string; icon: LucideIcon };

// The Figma bar has five links; profile settings, "ניהול" (super admin) and
// the active room live in the user menu.
const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "בית", icon: HouseIcon },
  { href: "/courses", label: "קורסים", icon: BookOpenIcon },
  { href: "/rooms", label: "חדרי לימוד", icon: UsersIcon },
  { href: "/students", label: "סטודנטים", icon: UserSearchIcon },
  { href: "/analytics", label: "ההתקדמות שלי", icon: ChartColumnIcon },
];

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type ShellProps = {
  userId: string;
  fullName: string;
  avatarPath: string | null;
  unreadNotifications: number;
  /** Private chats with unread messages (SPEC §5.1). */
  unreadMessages: number;
  activeRoomId: string | null;
  isSuperAdmin: boolean;
};

// Bell / messages (Figma): a bare 24px icon with a red count at its top start.
function IconLink({
  href,
  label,
  count,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted",
        active && "bg-primary-soft text-primary",
      )}
    >
      <Icon className="size-6" strokeWidth={1.8} aria-hidden />
      {count > 0 && (
        <span className="absolute -top-0.5 start-0.5 flex h-4 min-w-5 items-center justify-center rounded-full bg-[#f0384f] px-1.5 text-[11px] leading-none font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
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
      <label className="flex h-[46px] w-full items-center gap-2.5 rounded-xl bg-[#f2f5fa] px-4 text-foreground focus-within:ring-2 focus-within:ring-primary-line">
        <SearchIcon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
        <input
          type="search"
          name="q"
          aria-label="חיפוש"
          placeholder="חיפוש קורסים, חדרים או סטודנטים..."
          className="min-w-0 grow border-0 bg-transparent text-[15px] outline-none placeholder:text-[#6b7180]"
        />
      </label>
    </form>
  );
}

// Top bar per the Figma (07.11.2026): wordmark logo, five plain links (the
// active one tinted), a search field, then the user menu, messages and bell.
// lg+: links (icons only below 1400px); xl+: search. Below lg: hamburger.
export function AppNav(props: ShellProps) {
  const pathname = usePathname();
  const firstName = props.fullName.trim().split(/\s+/)[0] || props.fullName;

  const userMenu = (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger
        aria-label={`תפריט משתמש: ${props.fullName}`}
        className="flex h-11 shrink-0 items-center gap-3 rounded-full ps-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronDownIcon className="hidden size-4 md:block" strokeWidth={2} aria-hidden />
        <span className="hidden max-w-28 truncate text-base font-bold md:block">{firstName}</span>
        <PersonAvatar
          id={props.userId}
          name={props.fullName}
          avatarPath={props.avatarPath}
          className="size-[38px] shadow-[0_0_0_2px_#fff,0_0_0_3px_#dbe5f5]"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{props.fullName}</DropdownMenuLabel>
        {props.activeRoomId && (
          <DropdownMenuItem asChild>
            <Link href={`/rooms/${props.activeRoomId}`} className="text-success-ink">
              <LiveDot />
              חזרה לחדר הפעיל
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon />
            הגדרות פרופיל
          </Link>
        </DropdownMenuItem>
        {props.isSuperAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheckIcon />
              ניהול
            </Link>
          </DropdownMenuItem>
        )}
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
    <header className="sticky top-0 z-30 border-b border-[#edf0f5] bg-white">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-3 px-4 sm:px-8 lg:gap-6 xl:px-12">
        <Link href="/dashboard" aria-label="StuGether — דף הבית" className="shrink-0 rounded-lg">
          <LogoWordmark />
        </Link>

        <nav aria-label="ניווט ראשי" className="hidden items-center gap-1.5 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                title={link.label}
                className={cn(
                  "flex h-[46px] items-center gap-2 rounded-xl px-3 text-base font-medium whitespace-nowrap transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-[#f5f7fb]",
                )}
              >
                <link.icon className="size-5" strokeWidth={1.8} aria-hidden />
                <span className="max-[1399px]:sr-only">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <SearchBox className="ms-auto hidden max-w-[402px] min-w-[180px] flex-1 xl:block" />

        <div className="ms-auto flex shrink-0 items-center gap-2 sm:gap-3 xl:ms-0 xl:gap-4">
          <Link
            href="/courses"
            aria-label="חיפוש"
            title="חיפוש"
            className="flex size-10 items-center justify-center rounded-xl text-foreground hover:bg-muted max-sm:hidden xl:hidden"
          >
            <SearchIcon className="size-6" strokeWidth={1.8} aria-hidden />
          </Link>
          {userMenu}
          <IconLink
            href="/messages"
            label={
              props.unreadMessages > 0
                ? `הודעות (${props.unreadMessages} שיחות עם הודעות חדשות)`
                : "הודעות"
            }
            count={props.unreadMessages}
            active={isLinkActive(pathname, "/messages")}
            icon={MessageSquareTextIcon}
          />
          <IconLink
            href="/notifications"
            label={
              props.unreadNotifications > 0
                ? `התראות (${props.unreadNotifications} חדשות)`
                : "התראות"
            }
            count={props.unreadNotifications}
            active={isLinkActive(pathname, "/notifications")}
            icon={BellIcon}
          />

          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger
              aria-label="תפריט ניווט"
              className="relative flex size-10 items-center justify-center rounded-xl text-foreground hover:bg-muted lg:hidden"
            >
              <MenuIcon className="size-6" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {NAV_LINKS.map((link) => {
                const active = isLinkActive(pathname, link.href);
                return (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(active && "bg-primary-soft font-semibold text-primary")}
                    >
                      <link.icon />
                      <span className="grow">{link.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
