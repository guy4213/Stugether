import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";

const TONES = {
  blue: "bg-[oklch(0.94_0.04_250)] text-[oklch(0.45_0.17_255)]",
  teal: "bg-[oklch(0.94_0.05_175)] text-[oklch(0.45_0.1_180)]",
  purple: "bg-[oklch(0.94_0.04_295)] text-[oklch(0.45_0.17_295)]",
  orange: "bg-[oklch(0.95_0.05_65)] text-[oklch(0.5_0.14_55)]",
} as const;

export function StatCard({
  icon: Icon,
  value,
  label,
  tone = "blue",
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <Card className="border-0 shadow-sm ring-0">
      <CardContent className="flex items-center gap-4">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl",
            TONES[tone],
          )}
        >
          <Icon className="size-6" />
        </span>
        <div>
          <p className="text-2xl leading-none font-bold">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
