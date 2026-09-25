import { cn } from "cn";

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa
    .map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

// One segment per unit (e.g. topics); filled segments fade blue→teal, as in
// the dashboard hero.
export function SegmentedBar({
  total,
  filled,
  label,
  className,
}: {
  total: number;
  filled: number;
  label: string;
  className?: string;
}) {
  if (total <= 0) return null;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={filled}
      className={cn("flex gap-1", className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-2.5 grow rounded-[3px]"
          style={{
            background:
              i < filled ? mix("#2563eb", "#0d9488", filled > 1 ? i / (filled - 1) : 0) : "#e6ecf5",
          }}
        />
      ))}
    </div>
  );
}
