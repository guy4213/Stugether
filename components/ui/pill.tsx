import type { ComponentProps } from "react";
import { cn } from "cn";
import { TONE_SOFT, type Tone } from "@/lib/ui/tones";

// Rounded status chip ("חדר פעיל", "מבחן קרוב", "4 חדשות"...).
export function Pill({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        TONE_SOFT[tone],
        tone === "blue" && "text-primary-strong",
        className,
      )}
      {...props}
    />
  );
}
