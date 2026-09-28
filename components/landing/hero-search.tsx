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
      className="flex h-14 items-center overflow-hidden rounded-[18px] bg-white shadow-[0_24px_48px_-20px_rgba(2,12,40,.6)] sm:h-16"
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="חיפוש קורס, נושא או מוסד…"
        aria-label="חיפוש קורס, נושא או מוסד"
        className="h-full min-w-0 grow bg-transparent px-[22px] text-[17px] text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        aria-label="חיפוש"
        className="flex h-full w-[72px] shrink-0 items-center justify-center bg-brand-diag text-white hover:brightness-110 focus-visible:brightness-125 focus-visible:outline-none"
      >
        <SearchIcon className="size-6" strokeWidth={2.4} />
      </button>
    </form>
  );
}
