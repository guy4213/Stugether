import { CheckIcon } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { AVATAR_INPUT_ID } from "@/components/profile/avatar-uploader";

export interface CompletionItem {
  label: string;
  done: boolean;
  hint?: string;
}

// Mockup's "השלמת פרופיל": ring + next step + ✓/dashed chips, computed from
// what's actually saved.
export function ProfileCompletion({ items }: { items: CompletionItem[] }) {
  const done = items.filter((i) => i.done).length;
  const percent = Math.round((done / items.length) * 100);
  const missing = items.filter((i) => !i.done);
  const next = missing[0];
  const photoMissing = missing.some((i) => i.label === "תמונת פרופיל");

  return (
    <div className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-6">
      <h2 className="text-lg font-bold">השלמת פרופיל</h2>
      <div className="flex items-center gap-5">
        <ProgressRing
          value={percent}
          size={120}
          stroke={12}
          label={`הפרופיל הושלם ב-${percent} אחוזים`}
        >
          <span className="text-[30px] font-extrabold">{percent}%</span>
        </ProgressRing>
        <div className="flex flex-col gap-2.5">
          <span className="text-[15px] font-semibold">
            {missing.length === 0
              ? "הפרופיל מלא"
              : missing.length === 1
                ? "עוד צעד אחד"
                : `עוד ${missing.length} צעדים`}
          </span>
          {next?.hint && <span className="text-[13px] text-muted-foreground">{next.hint}</span>}
          {photoMissing && (
            <label
              htmlFor={AVATAR_INPUT_ID}
              className="flex h-[38px] cursor-pointer items-center self-start rounded-[11px] bg-primary-soft px-3.5 text-[13px] font-semibold text-primary-strong hover:bg-primary-tint"
            >
              העלאת תמונה
            </label>
          )}
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) =>
          item.done ? (
            <li
              key={item.label}
              className="flex h-8 items-center gap-[5px] rounded-full bg-success-soft px-3 text-[13px] font-semibold text-success-ink"
            >
              <CheckIcon className="size-[13px]" strokeWidth={3} aria-hidden />
              {item.label}
            </li>
          ) : (
            <li
              key={item.label}
              className="flex h-8 items-center gap-[5px] rounded-full border-[1.5px] border-dashed border-switch-off px-3 text-[13px] font-semibold text-muted-foreground"
            >
              <span aria-hidden className="size-[11px] rounded-full border-2 border-switch-off" />
              {item.label}
              <span className="sr-only">(חסר)</span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
