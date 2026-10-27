"use client";

import { CheckIcon, LoaderCircleIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";

// A selectable answer. "single" tiles live in a role="radiogroup" (one
// answer, picking it moves on); "multi" tiles are toggle buttons.
export function OptionTile({
  mode,
  selected,
  onSelect,
  label,
  hint,
  icon: Icon,
  disabled = false,
  loading = false,
}: {
  mode: "single" | "multi";
  selected: boolean;
  onSelect: () => void;
  label: string;
  hint?: string | null;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      role={mode === "single" ? "radio" : undefined}
      aria-checked={mode === "single" ? selected : undefined}
      aria-pressed={mode === "multi" ? selected : undefined}
      aria-busy={loading || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-[60px] w-full items-center gap-3 rounded-[18px] border-[1.5px] bg-white px-4 py-3 text-start transition-all duration-150 outline-none",
        "hover:border-primary-line hover:shadow-soft focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40",
        selected ? "border-primary bg-primary-soft shadow-highlight" : "border-border",
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            selected ? "bg-brand text-white" : "bg-primary-soft text-primary-strong",
          )}
        >
          <Icon className="size-5" strokeWidth={2} aria-hidden />
        </span>
      )}
      <span className="flex min-w-0 grow flex-col">
        <span className="text-[15px] font-semibold text-foreground">{label}</span>
        {hint && <span className="truncate text-[13px] text-muted-foreground">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
          selected ? "border-transparent bg-primary text-white" : "border-border bg-white",
        )}
      >
        {loading ? (
          <LoaderCircleIcon className="size-3.5 animate-spin text-primary" strokeWidth={3} />
        ) : (
          selected && <CheckIcon className="size-3.5" strokeWidth={3} />
        )}
      </span>
    </button>
  );
}

// A compact toggle chip (hobbies).
export function OptionChip({
  selected,
  onToggle,
  label,
  disabled = false,
}: {
  selected: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-[15px] transition-all duration-150 outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] disabled:opacity-35",
        selected
          ? "border-primary bg-primary-soft font-semibold text-primary-strong"
          : "border-border bg-white text-ink-2 hover:border-primary-line",
      )}
    >
      {selected && <CheckIcon className="size-4" strokeWidth={2.8} aria-hidden />}
      {label}
    </button>
  );
}

// "נבחרו 2 מתוך 3" — announced politely as the count changes.
export function PickCounter({ count, of }: { count: number; of: number }) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "text-sm font-semibold",
        count === of ? "text-success-ink" : "text-muted-foreground",
      )}
    >
      {count === of ? `מעולה, בחרת ${of} ✓` : `נבחרו ${count} מתוך ${of}`}
    </p>
  );
}
