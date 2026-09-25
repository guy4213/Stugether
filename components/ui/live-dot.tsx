import { cn } from "cn";

// Green "live" dot with the mockup's expanding pulse ring.
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-flex size-2 shrink-0", className)}>
      <span className="absolute inset-0 animate-live-pulse rounded-full bg-success motion-reduce:hidden" />
      <span className="relative size-full rounded-full bg-success" />
    </span>
  );
}
