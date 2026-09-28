import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SELECT_CLASS =
  "h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// GET form for the admin lists: filters live in the URL (searchParams), so a
// filtered view is linkable and needs no client state.
export function FilterForm({
  search,
  searchPlaceholder,
  children,
}: {
  search: string;
  searchPlaceholder: string;
  children?: React.ReactNode;
}) {
  return (
    <form role="search" className="flex flex-wrap items-center gap-2">
      <label className="flex h-10 min-w-56 grow items-center gap-2 rounded-xl border border-border bg-white px-3 focus-within:border-primary-line sm:grow-0">
        <SearchIcon className="size-4 text-muted-foreground" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="min-w-0 grow bg-transparent text-sm outline-none"
        />
      </label>
      {children}
      <Button type="submit" variant="solid" size="chip">
        סינון
      </Button>
    </form>
  );
}
