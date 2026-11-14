import { cn } from "cn";
import { getAvatarUrl } from "@/lib/storage";
import { defaultAvatarFor } from "@/lib/avatars/presets";
import { personTone } from "@/lib/ui/people";

export type StackPerson = { id: string; name: string; avatarPath?: string | null };

// Overlapping avatar circles with a "+N" overflow bubble (mockup: 26–36px,
// 2–3px white border, -8/-10px overlap). In RTL the first person sits on the
// right, like the design. Each circle is the person's photo, or their
// ready-made avatar (it used to be an empty tinted circle — client QA 11.2026).
export function AvatarStack({
  people,
  max = 3,
  total,
  size = "md",
  borderClassName = "border-white",
  className,
}: {
  people: StackPerson[];
  max?: number;
  total?: number;
  size?: "sm" | "md" | "lg";
  borderClassName?: string;
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
          title={p.name}
          className={cn(
            "flex items-center justify-center overflow-hidden rounded-full font-bold",
            sizeClass,
            borderClassName,
            personTone(p.id),
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- public storage URL, tiny avatar */}
          <img
            src={getAvatarUrl(p.avatarPath || defaultAvatarFor(p.id))}
            alt=""
            className="size-full object-cover"
          />
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
