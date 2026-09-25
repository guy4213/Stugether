import { useId } from "react";
import { cn } from "cn";

// StuGether mark: two overlapping rings on a rounded square.
//  brand   — blue→teal square, blue wordmark (app top nav)
//  inverse — frosted square, white/aqua rings, white wordmark (landing hero)
export function Logo({
  variant = "brand",
  size = 34,
  wordmark = true,
  className,
}: {
  variant?: "brand" | "inverse";
  size?: number;
  wordmark?: boolean;
  className?: string;
}) {
  const gradientId = useId();
  const inverse = variant === "inverse";

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563EB" />
            <stop offset="1" stopColor="#0D9488" />
          </linearGradient>
        </defs>
        <rect
          width="34"
          height="34"
          rx="10"
          fill={inverse ? "rgba(255,255,255,.14)" : `url(#${gradientId})`}
        />
        <circle cx="13.5" cy="17" r="6" fill="none" stroke="#fff" strokeWidth="2.4" />
        <circle
          cx="20.5"
          cy="17"
          r="6"
          fill="none"
          stroke={inverse ? "#5EEAD4" : "#fff"}
          strokeWidth="2.4"
          opacity={inverse ? 1 : 0.75}
        />
      </svg>
      {wordmark && (
        <span
          className={cn(
            "text-2xl font-extrabold tracking-[-0.3px]",
            inverse ? "text-white" : "text-primary-strong",
          )}
        >
          StuGether
        </span>
      )}
    </span>
  );
}
