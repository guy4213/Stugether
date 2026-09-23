"use client";

import { useState, useTransition } from "react";
import { StarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { toggleFavorite } from "@/lib/favorites/actions";

export function FavoriteButton({
  courseId,
  initialIsFavorite,
}: {
  courseId: string;
  initialIsFavorite: boolean;
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
      aria-label={isFavorite ? "הסר ממועדפים" : "הוסף למועדפים"}
      aria-pressed={isFavorite}
      className="flex size-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:text-primary disabled:opacity-50"
    >
      <StarIcon className={cn("size-4", isFavorite && "fill-primary text-primary")} />
    </button>
  );
}
