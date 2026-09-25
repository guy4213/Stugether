"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "lucide-react";

// Navigates to /courses with the query — an unauthenticated visitor hits the
// (app) group's login redirect, same as any other protected link.
export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    router.push(`/courses${params}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex max-w-lg items-center gap-2 rounded-2xl bg-white p-1.5 shadow-xl shadow-black/20"
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חיפוש קורס, נושא או מוסד..."
        aria-label="חיפוש קורס, נושא או מוסד"
        className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        aria-label="חיפוש"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90"
      >
        <SearchIcon className="size-5" />
      </button>
    </form>
  );
}
