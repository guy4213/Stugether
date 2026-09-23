import Link from "next/link";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/", label: "בית" },
  { href: "/lessons", label: "שיעורים" },
  { href: "/groups", label: "קבוצות" },
  { href: "/courses", label: "קורסים" },
  { href: "/institutions", label: "מוסדות" },
] as const;

export function SiteNav() {
  return (
    <header className="border-b border-border/10">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-bold text-primary">
          StuGether
        </Link>

        <ul className="hidden items-center gap-6 text-sm font-medium text-foreground/80 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/login">התחברות</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">הרשמה</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
