"use client";

import { MoonIcon, SunIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { ContinueButton, StepFrame } from "@/components/onboarding/step-frame";
import type { StudyTrack } from "@/lib/constants/profile-options";

const YEARS = [1, 2, 3, 4, 5, 6];
const SEMESTER_OPTIONS = [
  { value: 1, label: "א׳" },
  { value: 2, label: "ב׳" },
  { value: 3, label: "קיץ" },
];
const TRACK_OPTIONS: { value: StudyTrack; label: string; icon: LucideIcon }[] = [
  { value: "day", label: "בוקר", icon: SunIcon },
  { value: "evening", label: "ערב", icon: MoonIcon },
];

// Year, semester and track on one screen: three quick taps.
export function DegreeStep({
  year,
  semester,
  track,
  onChange,
  onContinue,
  pending,
}: {
  year: number | null;
  semester: number | null;
  track: StudyTrack | null;
  onChange: (patch: { year?: number; semester?: number; track?: StudyTrack }) => void;
  onContinue: () => void;
  pending: boolean;
}) {
  return (
    <StepFrame
      title="איפה את/ה בתואר?"
      subtitle="כדי שנציע לך את הקורסים של הסמסטר הזה"
      footer={
        <ContinueButton disabled={!year || !semester || !track || pending} onClick={onContinue}>
          {pending ? "טוען קורסים..." : "המשך"}
        </ContinueButton>
      }
    >
      <Segmented
        label="שנת לימודים"
        options={YEARS.map((y) => ({ value: y, label: String(y) }))}
        value={year}
        onChange={(v) => onChange({ year: v })}
      />
      <Segmented
        label="סמסטר"
        options={SEMESTER_OPTIONS}
        value={semester}
        onChange={(v) => onChange({ semester: v })}
      />
      <Segmented
        label="מסלול לימודים"
        options={TRACK_OPTIONS}
        value={track}
        onChange={(v) => onChange({ track: v })}
      />
    </StepFrame>
  );
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="mb-2 flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-ink-2">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] text-[15px] font-semibold transition-all duration-150 outline-none",
                "focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]",
                selected
                  ? "border-transparent bg-brand text-white shadow-glow-blue"
                  : "border-border bg-white text-ink-2 hover:border-primary-line",
              )}
            >
              {o.icon && <o.icon className="size-[18px]" strokeWidth={2} aria-hidden />}
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
