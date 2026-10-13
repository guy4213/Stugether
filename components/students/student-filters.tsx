"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; name: string };

const ALL = "all";
const YEARS = [1, 2, 3, 4];

// Search + filters for /students, kept in the URL (?q, institutionId,
// departmentId, year, courseId, online). Any change returns to page 1.
export function StudentFilters({
  institutions,
  departments,
  myCourses,
}: {
  institutions: Option[];
  departments: Option[];
  myCourses: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function navigate(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  const setParam = (key: string, value: string | null) =>
    navigate((p) => (value && value !== ALL ? p.set(key, value) : p.delete(key)));

  // Debounced name search, like the course search box.
  useEffect(() => {
    if (query.trim() === (searchParams.get("q") ?? "")) return;
    const timer = setTimeout(() => setParam("q", query.trim() || null), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const online = searchParams.get("online") === "1";
  const select = (
    key: string,
    label: string,
    options: Option[],
    onChange?: (p: URLSearchParams) => void,
  ) => {
    const value = searchParams.get(key) ?? ALL;
    const current = options.find((o) => o.id === value);
    return (
      <Select
        value={value}
        onValueChange={(v) =>
          navigate((p) => {
            if (v && v !== ALL) p.set(key, v);
            else p.delete(key);
            onChange?.(p);
          })
        }
      >
        <SelectTrigger aria-label={label} className="h-[42px] min-w-36 rounded-xl bg-white text-sm">
          {/* Explicit text: Radix fills SelectValue only after hydration. */}
          <SelectValue placeholder={label}>{current ? current.name : `${label}: הכל`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{label}: הכל</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex h-[52px] items-center gap-3 rounded-[16px] border border-border bg-white px-4 text-muted-foreground focus-within:border-primary-line">
        {isPending ? (
          <Loader2Icon className="size-5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <SearchIcon className="size-5 shrink-0" aria-hidden />
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="חיפוש סטודנט"
          placeholder="חיפוש סטודנט לפי שם"
          className="min-w-0 grow border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="סינון סטודנטים">
        <button
          type="button"
          aria-pressed={online}
          onClick={() => setParam("online", online ? null : "1")}
          className={cn(
            "flex h-[42px] items-center gap-2 rounded-full px-4 text-sm transition-colors",
            online
              ? "bg-success-soft font-bold text-success-ink"
              : "border border-border bg-white font-medium text-ink-2 hover:border-primary-line",
          )}
        >
          <span className="size-2 rounded-full bg-success" aria-hidden />
          מחוברים עכשיו
        </button>
        {myCourses.length > 0 && select("courseId", "קורס משותף", myCourses)}
        {institutions.length > 1 &&
          select("institutionId", "מוסד", institutions, (p) => p.delete("departmentId"))}
        {departments.length > 0 && select("departmentId", "מחלקה", departments)}
        {select(
          "year",
          "שנה",
          YEARS.map((y) => ({ id: String(y), name: `שנה ${y}` })),
        )}
      </div>
    </div>
  );
}
