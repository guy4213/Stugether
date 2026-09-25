import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface CompletionItem {
  label: string;
  done: boolean;
}

// Mockup's "Profile Completion" ring, computed from what's actually saved.
export function ProfileCompletion({ items }: { items: CompletionItem[] }) {
  const done = items.filter((i) => i.done).length;
  const percent = Math.round((done / items.length) * 100);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <Card className="border-0 shadow-sm ring-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold">השלמת פרופיל</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="relative mx-auto size-36">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <defs>
              <linearGradient id="completion-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--secondary)" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="url(#completion-gradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - percent / 100)}
            />
          </svg>
          <p
            className="absolute inset-0 flex items-center justify-center text-3xl font-bold"
            aria-label={`הפרופיל הושלם ב-${percent} אחוזים`}
          >
            {percent}%
          </p>
        </div>

        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5 text-sm">
              {item.done ? (
                <CheckCircle2Icon className="size-5 shrink-0 text-[oklch(0.55_0.13_165)]" />
              ) : (
                <CircleIcon className="size-5 shrink-0 text-muted-foreground/50" />
              )}
              <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
