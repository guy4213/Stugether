"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDownIcon, Loader2Icon, SearchIcon } from "lucide-react";
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
    // A new search / filter / sort starts from the first page.
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  return { searchParams, navigate, isPending };
}

// Hero search (Figma "קורסים"): white 64px field with a gradient "חיפוש"
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
      className="flex h-16 items-center gap-3 rounded-[18px] bg-white ps-[18px] pe-2 text-[#4a5160] shadow-[0_6px_18px_rgba(20,60,120,.12)]"
    >
      {isPending ? (
        <Loader2Icon className="size-6 shrink-0 animate-spin" aria-hidden />
      ) : (
        <SearchIcon className="size-6 shrink-0" strokeWidth={1.8} aria-hidden />
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="חיפוש קורס"
        placeholder="חיפוש קורס לפי שם או קוד"
        className="min-w-0 grow border-0 bg-transparent text-lg text-foreground outline-none placeholder:text-[#8b8f99]"
      />
      <button
        type="submit"
        className="h-12 shrink-0 rounded-[14px] bg-figma-brand px-7 text-[17px] font-bold text-white transition hover:brightness-105"
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
        "inline-flex h-[46px] shrink-0 items-center rounded-full px-5 text-[17px] transition-colors",
        active
          ? "border border-transparent bg-figma-brand font-bold text-white shadow-[0_4px_10px_rgba(80,146,241,.25)]"
          : "border border-[#dbe5f5] bg-white font-medium text-[#3b3b3b] hover:border-[#b9c9e6]",
      )}
    >
      {children}
    </button>
  );
}

const SORTS = [
  { value: "relevance", label: "רלוונטיות" },
  { value: "progress", label: "התקדמות" },
  { value: "exam", label: "מבחן קרוב" },
  { value: "az", label: "שם הקורס" },
];

// Chips (הכל / הקורסים שלי / מועדפים | departments) + sort, per the Figma.
export function CoursesFilterBar({ departments }: { departments: Department[] }) {
  const { searchParams, navigate } = useUrlParams();
  const departmentId = searchParams.get("departmentId");
  const view =
    searchParams.get("view") ?? (searchParams.get("favorites") === "1" ? "favorites" : "all");
  // Matches parseCourseSort: a department defaults to its study plan.
  const defaultSort = departmentId ? "semester" : "relevance";
  const sort = searchParams.get("sort") ?? defaultSort;
  const setView = (next: string) =>
    navigate((p) => {
      p.delete("favorites");
      if (next === "all") p.delete("view");
      else p.set("view", next);
    });
  // "semester" is only offered inside a department, so leaving one drops it.
  const dropSemesterSort = (p: URLSearchParams) => {
    if (p.get("sort") === "semester") p.delete("sort");
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div
        className="flex items-center gap-2.5 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0"
        role="group"
        aria-label="סינון קורסים"
      >
        <Chip
          active={view === "all" && !departmentId}
          onClick={() =>
            navigate((p) => {
              p.delete("view");
              p.delete("favorites");
              p.delete("departmentId");
              dropSemesterSort(p);
            })
          }
        >
          הכל
        </Chip>
        <Chip active={view === "mine"} onClick={() => setView(view === "mine" ? "all" : "mine")}>
          הקורסים שלי
        </Chip>
        <Chip
          active={view === "favorites"}
          onClick={() => setView(view === "favorites" ? "all" : "favorites")}
        >
          מועדפים
        </Chip>
        {departments.length > 0 && (
          <span aria-hidden className="mx-1 h-7 w-px shrink-0 bg-[#dbe5f5]" />
        )}
        {departments.map((dept) => (
          <Chip
            key={dept.id}
            active={departmentId === dept.id}
            onClick={() =>
              navigate((p) => {
                if (departmentId === dept.id) p.delete("departmentId");
                else p.set("departmentId", dept.id);
                dropSemesterSort(p);
              })
            }
          >
            {dept.name}
          </Chip>
        ))}
      </div>
      <label className="flex shrink-0 items-center gap-3 text-base text-[#737885]">
        מיון
        <span className="relative">
          <select
            value={sort}
            onChange={(e) =>
              navigate((p) =>
                e.target.value === defaultSort ? p.delete("sort") : p.set("sort", e.target.value),
              )
            }
            className="h-[46px] w-[185px] cursor-pointer appearance-none rounded-xl border border-[#dbe5f5] bg-white ps-5 pe-10 text-[17px] font-medium text-foreground"
          >
            {departmentId && <option value="semester">לפי שנה וסמסטר</option>}
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden
            className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-foreground"
          />
        </span>
      </label>
    </div>
  );
}
