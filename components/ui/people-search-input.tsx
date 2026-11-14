"use client";

import { SearchIcon } from "lucide-react";
import { cn } from "cn";

// The search box above a student list (client QA 12.11.2026: "חיפוש סטודנט
// מתוך רשימת סטודנטים בכל מקום באתר"). Filtering is the list's job —
// lib/ui/people.ts filterPeople().
export function PeopleSearchInput({
  value,
  onChange,
  placeholder = "חיפוש סטודנט לפי שם",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-primary-line",
        className,
      )}
    >
      <SearchIcon className="size-4 shrink-0" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 grow bg-transparent text-sm text-foreground outline-none"
      />
    </label>
  );
}

export function NoPeopleFound({ query }: { query: string }) {
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">
      לא נמצאו סטודנטים בשם „{query.trim()}“
    </p>
  );
}
