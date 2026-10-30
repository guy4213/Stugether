"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";
const VIEWS = [
  { id: "all", label: "הכל" },
  { id: "live", label: "פעילים עכשיו" },
  { id: "mine", label: "החדרים שלי" },
] as const;

// View chips, search and course filter for /rooms, kept in the URL
// (?view, q, courseId).
export function RoomsFilters({ courses }: { courses: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const sentQuery = useRef(urlQuery);
  useEffect(() => {
    if (urlQuery === sentQuery.current) return;
    sentQuery.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== ALL) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (query.trim() === urlQuery) return;
    const timer = setTimeout(() => {
      sentQuery.current = query.trim();
      setParam("q", query.trim() || null);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const view = searchParams.get("view") ?? ALL;
  const courseId = searchParams.get("courseId") ?? ALL;
  const course = courses.find((c) => c.id === courseId);

  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-card p-3 shadow-card lg:flex-row lg:items-center lg:gap-4 lg:p-[13px]">
      <div className="flex gap-2.5" role="group" aria-label="תצוגה">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => setParam("view", v.id)}
            className={cn(
              "h-[50px] shrink-0 rounded-full px-5 text-[15px] transition-colors sm:px-6",
              view === v.id
                ? "bg-linear-to-b from-primary to-primary-strong font-bold text-white shadow-glow-blue"
                : "border border-border bg-white font-medium text-foreground hover:border-primary-line",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <label className="flex h-[50px] min-w-0 grow items-center gap-3 rounded-[14px] border border-border bg-surface-2 px-4 text-muted-foreground focus-within:border-primary-line">
        {isPending ? (
          <Loader2Icon className="size-5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <SearchIcon className="size-5 shrink-0" aria-hidden />
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="חיפוש חדר"
          placeholder="חיפוש לפי שם חדר, קורס, נושא, סטודנט..."
          className="min-w-0 grow border-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      {courses.length > 0 && (
        <Select value={courseId} onValueChange={(v) => setParam("courseId", v)}>
          <SelectTrigger
            aria-label="קורס"
            className="h-[50px]! min-w-48 rounded-[14px] border-border bg-white px-4 text-[15px]"
          >
            <FilterIcon className="size-5 text-primary" aria-hidden />
            <SelectValue placeholder="כל הקורסים">
              {course ? course.name : "כל הקורסים"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>כל הקורסים</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
