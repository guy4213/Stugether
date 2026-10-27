"use client";

import { useState } from "react";
import { SearchIcon, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OptionTile } from "@/components/onboarding/option-tile";
import { StepFrame } from "@/components/onboarding/step-frame";

const SEARCH_FROM = 8;

// Institution / faculty / department: one tap picks and moves on.
export function ChoiceStep({
  title,
  subtitle,
  icon,
  options,
  selectedId,
  pendingId,
  onSelect,
  searchPlaceholder,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  options: { id: string; label: string; hint?: string | null }[];
  selectedId: string;
  /** The tile whose next step is loading. */
  pendingId?: string | null;
  onSelect: (id: string) => void;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const shown = q ? options.filter((o) => o.label.includes(q) || o.hint?.includes(q)) : options;

  return (
    <StepFrame title={title} subtitle={subtitle}>
      {options.length >= SEARCH_FROM && (
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-12 rounded-[16px] border-[1.5px] bg-white ps-11 text-[15px] shadow-none"
          />
        </div>
      )}
      <div role="radiogroup" aria-label={title} className="flex flex-col gap-2.5">
        {shown.map((o) => (
          <OptionTile
            key={o.id}
            mode="single"
            icon={icon}
            label={o.label}
            hint={o.hint}
            selected={o.id === selectedId}
            loading={o.id === pendingId}
            disabled={!!pendingId && o.id !== pendingId}
            onSelect={() => onSelect(o.id)}
          />
        ))}
        {shown.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {options.length === 0 ? "אין כאן עדיין אפשרויות" : "לא מצאנו. נסו מילה אחרת"}
          </p>
        )}
      </div>
    </StepFrame>
  );
}
