"use client";

import { cn } from "cn";
import { lastSeenHe } from "@/lib/ui/format";

// "מחובר/ת עכשיו" (green dot) or "התחבר/ה לפני שעתיים" (client QA 11.2026).
// Relative to the viewer's clock, so the server's rendering may differ by a
// minute: suppressHydrationWarning on the text only.
export function LastSeen({
  online,
  lastSeenAt,
  className,
}: {
  online: boolean;
  lastSeenAt: string | null | undefined;
  className?: string;
}) {
  if (online) {
    return (
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold text-success-ink",
          className,
        )}
      >
        <span className="size-[7px] rounded-full bg-success" aria-hidden />
        מחובר/ת עכשיו
      </span>
    );
  }
  return (
    <span className={cn("text-xs text-muted-foreground", className)} suppressHydrationWarning>
      {lastSeenHe(lastSeenAt)}
    </span>
  );
}
