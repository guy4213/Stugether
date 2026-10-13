import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";

// Page links for list pages (/courses, /students). Server-rendered; every
// link keeps the current search / filters (params) and only changes ?page=.
export function Pagination({
  basePath,
  page,
  pageCount,
  params,
}: {
  basePath: string;
  page: number;
  pageCount: number;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;

  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  // 1 … page-1 page page+1 … last
  const pages: (number | "gap")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages.at(-1) !== "gap") pages.push("gap");
  }

  const arrow =
    "flex size-[42px] items-center justify-center rounded-full border border-border bg-white text-ink-2 hover:border-primary-line";

  return (
    <nav aria-label="עמודים" className="flex items-center justify-center gap-2 pt-2">
      {/* RTL: "previous" points right. */}
      {page > 1 ? (
        <Link href={href(page - 1)} className={arrow} aria-label="העמוד הקודם">
          <ChevronRightIcon className="size-5" aria-hidden />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-40")} aria-hidden>
          <ChevronRightIcon className="size-5" />
        </span>
      )}
      {pages.map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "flex h-[42px] min-w-[42px] items-center justify-center rounded-full px-3 text-sm",
              p === page
                ? "bg-brand font-bold text-white"
                : "border border-border bg-white font-medium text-ink-2 hover:border-primary-line",
            )}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={href(page + 1)} className={arrow} aria-label="העמוד הבא">
          <ChevronLeftIcon className="size-5" aria-hidden />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-40")} aria-hidden>
          <ChevronLeftIcon className="size-5" />
        </span>
      )}
    </nav>
  );
}
