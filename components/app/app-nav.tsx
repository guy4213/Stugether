"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  BellIcon,
  BookOpenIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAvatarUrl } from "@/lib/storage";
import { signOutAndRedirect } from "@/lib/auth/session-actions";

const NAV_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "בית", icon: HomeIcon },
  { href: "/courses", label: "קורסים", icon: BookOpenIcon },
  { href: "/analytics", label: "ההתקדמות שלי", icon: BarChart3Icon },
  { href: "/notifications", label: "התראות", icon: BellIcon },
  { href: "/profile", label: "הגדרות פרופיל", icon: UserIcon },
];

function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

type ShellProps = { fullName: string; avatarPath: string | null; pendingInvitations: number };

function UserAvatar({ fullName, avatarPath, className }: ShellProps & { className?: string }) {
  return (
    <Avatar className={className}>
      {avatarPath && <AvatarImage src={getAvatarUrl(avatarPath)} alt={fullName} />}
      <AvatarFallback className="bg-primary/10 font-medium text-primary">
        {initials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}

function NavBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ms-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
      {count}
    </span>
  );
}

// Desktop: sidebar (as in the dashboard mockup). Mobile: compact top bar
// with a dropdown menu, since a fixed sidebar doesn't fit a phone.
export function AppNav(props: ShellProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-border/60 bg-card/60 p-4 lg:flex">
        <Link href="/dashboard" className="mb-6 px-2 text-2xl font-bold text-primary">
          StuGether
        </Link>

        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <UserAvatar {...props} className="size-20 ring-4 ring-background" />
          <div>
            <p className="font-semibold">{props.fullName}</p>
            <p className="text-xs text-muted-foreground">סטודנט/ית</p>
          </div>
        </div>

        <nav aria-label="ניווט ראשי" className="flex-1">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => {
              const isActive = isLinkActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive &&
                        "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    <link.icon className="size-4.5" />
                    {link.label}
                    {link.href === "/notifications" && (
                      <NavBadge count={props.pendingInvitations} />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <form action={signOutAndRedirect}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOutIcon className="size-4.5" />
            התנתקות
          </button>
        </form>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="text-lg font-bold text-primary">
          StuGether
        </Link>
        <div className="flex items-center gap-2">
          <UserAvatar {...props} className="size-8" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="תפריט ניווט">
                <MenuIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {NAV_LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link
                    href={link.href}
                    aria-current={isLinkActive(pathname, link.href) ? "page" : undefined}
                  >
                    <link.icon />
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <form action={signOutAndRedirect} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2 text-destructive">
                    <LogOutIcon className="size-4" />
                    התנתקות
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}
