"use client";

import Link from "next/link";
import { EllipsisIcon, EllipsisVerticalIcon } from "lucide-react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The "⋮" of a rooms-table row and the "⋯" of a course card.
export function RowMenu({
  label,
  items,
  orientation = "vertical",
  className,
}: {
  label: string;
  items: { label: string; href: string }[];
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  const Icon = orientation === "vertical" ? EllipsisVerticalIcon : EllipsisIcon;
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
          className,
        )}
      >
        <Icon className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-40">
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link prefetch={false} href={item.href}>
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
