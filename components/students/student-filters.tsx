"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { cn } from "cn";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  STUDY_TIMES,
  STUDY_TIME_LABEL,
  STUDY_TRACKS,
  TRACK_LABEL,
} from "@/lib/constants/profile-options";

type Option = { id: string; name: string };

const ALL = "all";
const YEARS = [1, 2, 3, 4];
const TRACK_OPTIONS: Option[] = STUDY_TRACKS.map((t) => ({ id: t, name: TRACK_LABEL[t] }));

// Search + filters for /students (Figma "כרטיסיות סטודנטים"), kept in the URL
// (?q, courseId, track, institutionId, departmentId, year, online, times).
// Any change returns to page 1.
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
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  // The q this box last sent. Any other change of the URL (ניקוי הסינון,
  // Back) is taken into the box.
  const sentQuery = useRef(urlQuery);
  useEffect(() => {
    if (urlQuery === sentQuery.current) return;
    sentQuery.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  function navigate(mutate: (p: URLSearchParams) => void) {
    // The live URL, not the render's searchParams: the debounced search may
    // fire after a select already changed it.
    const params = new URLSearchParams(window.location.search);
    mutate(params);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  const setParam = (key: string, value: string | null) =>
    navigate((p) => (value && value !== ALL ? p.set(key, value) : p.delete(key)));

  // Debounced name search, like the course search box.
  useEffect(() => {
    if (query.trim() === urlQuery) return;
    const timer = setTimeout(() => {
      sentQuery.current = query.trim();
      setParam("q", query.trim() || null);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const online = searchParams.get("online") === "1";
  const times = (searchParams.get("times") ?? "").split(",").filter(Boolean);
  const moreCount = ["institutionId", "departmentId", "year", "online"].filter((k) =>
    searchParams.get(k),
  ).length;

  function toggleTime(t: string) {
    const next = times.includes(t) ? times.filter((x) => x !== t) : [...times, t];
    setParam("times", next.length ? STUDY_TIMES.filter((x) => next.includes(x)).join(",") : null);
  }

  const select = (
    key: string,
    label: string,
    options: Option[],
    { onChange, bare = false }: { onChange?: (p: URLSearchParams) => void; bare?: boolean } = {},
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
        <SelectTrigger
          aria-label={label}
          className={cn(
            "text-[15px]",
            bare
              ? "h-[52px]! min-w-40 border-0 bg-transparent px-3 font-bold shadow-none"
              : "h-[42px] w-full rounded-xl bg-white text-sm",
          )}
        >
          {/* Explicit text: Radix fills SelectValue only after hydration. */}
          <SelectValue placeholder={label}>
            {current ? current.name : bare ? label : `${label}: הכל`}
          </SelectValue>
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 rounded-[18px] bg-primary-tint/70 p-2 lg:flex-row lg:items-center lg:gap-1">
        <label className="flex h-[52px] min-w-0 grow items-center gap-3 rounded-[14px] bg-primary-tint px-4 text-muted-foreground focus-within:ring-2 focus-within:ring-primary-line">
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
            placeholder="חיפוש סטודנט לפי שם..."
            className="min-w-0 grow border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="סינון סטודנטים">
          {myCourses.length > 0 && select("courseId", "קורס משותף", myCourses, { bare: true })}
          {select("track", "מסלול לימודים", TRACK_OPTIONS, { bare: true })}
          <Popover>
            <PopoverTrigger className="flex h-[52px] items-center gap-2 rounded-[12px] px-4 text-[15px] font-bold hover:bg-white/60">
              <SlidersHorizontalIcon className="size-5" aria-hidden />
              מסננים נוספים
              {moreCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-white">
                  {moreCount}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent align="end" className="flex w-72 flex-col gap-2.5 p-4">
              <button
                type="button"
                aria-pressed={online}
                onClick={() => setParam("online", online ? null : "1")}
                className={cn(
                  "flex h-[42px] items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors",
                  online
                    ? "bg-success-soft font-bold text-success-ink"
                    : "border border-border bg-white font-medium text-ink-2 hover:border-primary-line",
                )}
              >
                <span className="size-2 rounded-full bg-success" aria-hidden />
                מחוברים עכשיו
              </button>
              {institutions.length > 1 &&
                select("institutionId", "מוסד", institutions, {
                  onChange: (p) => p.delete("departmentId"),
                })}
              {departments.length > 0 && select("departmentId", "מחלקה", departments)}
              {select(
                "year",
                "שנה",
                YEARS.map((y) => ({ id: String(y), name: `שנה ${y}` })),
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[22px] font-extrabold">מתי נוח לך ללמוד?</h2>
          <p className="text-[15px] text-foreground">בחרו את כל הזמנים שמתאימים לכם</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="זמני למידה">
          {STUDY_TIMES.map((t) => {
            const on = times.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTime(t)}
                className={cn(
                  "h-[42px] min-w-[100px] rounded-full px-6 text-[15px] transition-colors",
                  on
                    ? "bg-primary font-bold text-white shadow-glow-blue"
                    : "border-[1.5px] border-primary bg-white font-medium text-primary hover:bg-primary-soft",
                )}
              >
                {STUDY_TIME_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
