"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import type { Department } from "@/lib/repositories/catalog";

function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  return { searchParams, navigate, isPending };
}

// Hero search (Discover.dc.html): white 60px field with a gradient "חיפוש"
// button. Typing is debounced into ?q=; the button / Enter applies at once.
export function CourseSearchBox() {
  const { searchParams, navigate, isPending } = useUrlParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const apply = (value: string) =>
    navigate((p) => (value.trim() ? p.set("q", value.trim()) : p.delete("q")));

  // Debounced: a server round trip per keystroke made typing feel sluggish.
  useEffect(() => {
    // Compare with the URL rather than a "first run" ref, which StrictMode's
    // double-run effects defeat (caused a spurious navigation on load).
    if (query.trim() === (searchParams.get("q") ?? "")) return;
    const timer = setTimeout(() => apply(query), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        apply(query);
      }}
      className="flex h-[60px] items-center gap-3 rounded-[18px] bg-white ps-5 pe-2 text-muted-foreground shadow-[0_10px_24px_-10px_rgba(15,27,51,.35)]"
    >
      {isPending ? (
        <Loader2Icon className="size-[22px] shrink-0 animate-spin" aria-hidden />
      ) : (
        <SearchIcon className="size-[22px] shrink-0" strokeWidth={2} aria-hidden />
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="חיפוש קורס"
        placeholder="חיפוש קורס לפי שם או קוד"
        className="min-w-0 grow border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        className="h-[46px] shrink-0 rounded-[13px] bg-brand px-6 text-[15px] font-bold text-white hover:brightness-105"
      >
        חיפוש
      </button>
    </form>
  );
}

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
        "inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-full px-[18px] text-sm transition-colors",
        active
          ? "bg-brand px-5 font-bold text-white shadow-[0_8px_16px_-8px_rgba(37,99,235,.6)]"
          : "border border-border bg-white font-medium text-ink-2 hover:border-primary-line",
      )}
    >
      {children}
    </button>
  );
}

function StarOutline() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F59E0B"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  );
}

// Chips (הכל / מועדפים / departments) + sort select.
export function CoursesFilterBar({ departments }: { departments: Department[] }) {
  const { searchParams, navigate } = useUrlParams();
  const departmentId = searchParams.get("departmentId");
  const favoritesOnly = searchParams.get("favorites") === "1";
  const sort = searchParams.get("sort") ?? "popular";

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="סינון קורסים">
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
          <StarOutline />
          מועדפים
        </Chip>
        {departments.map((dept) => (
          <Chip
            key={dept.id}
            active={departmentId === dept.id}
            onClick={() =>
              navigate((p) =>
                departmentId === dept.id ? p.delete("departmentId") : p.set("departmentId", dept.id),
              )
            }
          >
            {dept.name}
          </Chip>
        ))}
      </div>
      <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        מיון
        <select
          value={sort}
          onChange={(e) =>
            navigate((p) =>
              e.target.value === "popular" ? p.delete("sort") : p.set("sort", e.target.value),
            )
          }
          className="h-[42px] rounded-xl border border-border bg-white px-3.5 text-sm text-foreground"
        >
          <option value="popular">הכי פופולרי</option>
          <option value="rooms">הכי הרבה חדרים</option>
          <option value="az">א׳–ת׳</option>
        </select>
      </label>
    </div>
  );
}
