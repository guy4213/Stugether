import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xl leading-none font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
