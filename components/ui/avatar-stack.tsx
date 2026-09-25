import { cn } from "cn";
import { initials, personTone } from "@/lib/ui/people";

export type StackPerson = { id: string; name: string };

// Overlapping initials circles with a "+N" overflow bubble (mockup: 26–36px,
// 2–3px white border, -8/-10px overlap). In RTL the first person sits on the
// right, like the design.
export function AvatarStack({
  people,
  max = 3,
  total,
  size = "md",
  borderClassName = "border-white",
  showInitials = false,
  className,
}: {
  people: StackPerson[];
  max?: number;
  total?: number;
  size?: "sm" | "md" | "lg";
  borderClassName?: string;
  showInitials?: boolean;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = (total ?? people.length) - shown.length;
  const sizeClass = {
    sm: "size-[26px] text-[10px] -ms-2 first:ms-0 border-2",
    md: "size-7 text-[10px] -ms-2 first:ms-0 border-2",
    lg: "size-9 text-[13px] -ms-2.5 first:ms-0 border-3",
  }[size];

  if (shown.length === 0) return null;

  return (
    <span className={cn("flex", className)} aria-hidden>
      {shown.map((p) => (
        <span
          key={p.id}
          className={cn(
            "flex items-center justify-center rounded-full font-bold",
            sizeClass,
            borderClassName,
            personTone(p.id),
          )}
        >
          {showInitials ? initials(p.name) : null}
        </span>
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-violet-soft font-bold text-violet",
            sizeClass,
            borderClassName,
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
