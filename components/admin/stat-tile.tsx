import type { LucideIcon } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import type { Tone } from "@/lib/ui/tones";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[20px] border border-border bg-card p-5 shadow-card">
      <IconTile tone={tone}>
        <Icon strokeWidth={2} />
      </IconTile>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-extrabold tabular-nums">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}
