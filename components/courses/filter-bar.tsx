"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SearchIcon, StarIcon, Loader2Icon } from "lucide-react";
import { cn } from "cn";
import type { Department } from "@/lib/repositories/catalog";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

export function CoursesFilterBar({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const departmentId = searchParams.get("departmentId");
  const favoritesOnly = searchParams.get("favorites") === "1";

  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounced: a server round trip per keystroke made typing feel sluggish.
  useEffect(() => {
    // Compare with the URL rather than a "first run" ref, which StrictMode's
    // double-run effects defeat (caused a spurious navigation on load).
    if (query.trim() === (searchParams.get("q") ?? "")) return;
    const timer = setTimeout(() => {
      navigate((p) => (query.trim() ? p.set("q", query.trim()) : p.delete("q")));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש קורס לפי שם או קוד..."
          aria-label="חיפוש קורס"
          className="h-12 w-full rounded-2xl border border-border bg-card ps-12 pe-12 text-base shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />
        {isPending && (
          <Loader2Icon className="absolute end-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="סינון לפי מחלקה">
        <Chip
          active={!departmentId && !favoritesOnly}
          onClick={() =>
            navigate((p) => {
              p.delete("departmentId");
              p.delete("favorites");
            })
          }
        >
          הכל
        </Chip>
        <Chip
          active={favoritesOnly}
          onClick={() =>
            navigate((p) => (favoritesOnly ? p.delete("favorites") : p.set("favorites", "1")))
          }
        >
          <StarIcon className={cn("size-3.5", favoritesOnly && "fill-current")} />
          מועדפים
        </Chip>
        {departments.map((dept) => (
          <Chip
            key={dept.id}
            active={departmentId === dept.id}
            onClick={() =>
              navigate((p) =>
                departmentId === dept.id
                  ? p.delete("departmentId")
                  : p.set("departmentId", dept.id),
              )
            }
          >
            {dept.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}
