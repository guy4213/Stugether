import type { ComponentProps } from "react";
import { cn } from "cn";
import { TONE_SOFT, type Tone } from "@/lib/ui/tones";

// Rounded-square icon holder (mockup: 40–72px, radius ≈ 30% of the size).
export function IconTile({
  tone = "blue",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-[14px] [&_svg]:size-[22px]",
        TONE_SOFT[tone],
        className,
      )}
      {...props}
    />
  );
}
