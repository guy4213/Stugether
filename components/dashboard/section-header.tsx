import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ChevronLeftIcon } from "lucide-react";

// Title row above each dashboard block: "שותפים ללמידה ... הצג הכל ←".
export function SectionHeader({
  id,
  title,
  extra,
  link,
  actions,
}: {
  id: string;
  title: string;
  /** Next to the title, e.g. the "פעילים" pill. */
  extra?: ReactNode;
  link?: { href: string; label: string; chevron?: boolean };
  /** Before the link, e.g. "חדר חדש". */
  actions?: ReactNode;
}) {
  const Arrow = link?.chevron ? ChevronLeftIcon : ArrowLeftIcon;
  return (
    <div className="flex min-h-9 items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2 id={id} className="text-xl font-extrabold">
          {title}
        </h2>
        {extra}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        {link && (
          <Link
            href={link.href}
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-strong"
          >
            {link.label}
            <Arrow className="size-4" strokeWidth={2.2} aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
