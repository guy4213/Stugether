"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { toggleFavorite } from "@/lib/favorites/actions";

// Star toggle. "light" = white disc on course covers (Discover cards);
// "glass" = frosted square on the course banner.
export function FavoriteButton({
  courseId,
  initialIsFavorite,
  variant = "light",
  className,
}: {
  courseId: string;
  initialIsFavorite: boolean;
  variant?: "light" | "glass";
  className?: string;
}) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = !isFavorite;
    setIsFavorite(next);
    startTransition(async () => {
      const result = await toggleFavorite(courseId, next);
      if (!result.ok) {
        setIsFavorite(!next);
        toast.error(result.error ?? "משהו השתבש");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={isFavorite ? "הסרה מהמועדפים" : "הוספה למועדפים"}
      aria-pressed={isFavorite}
      className={cn(
        "flex items-center justify-center transition-colors disabled:opacity-70",
        variant === "light"
          ? cn(
              "size-9 rounded-full",
              isFavorite ? "bg-white text-warning" : "bg-white/90 text-muted-foreground hover:text-warning",
            )
          : cn(
              "size-11 rounded-[13px] border border-white/40 bg-white/14 hover:bg-white/22",
              isFavorite ? "text-[#FDE68A]" : "text-white",
            ),
        className,
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={isFavorite ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
      </svg>
    </button>
  );
}
