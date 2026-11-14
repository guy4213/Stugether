"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { normalizeSearch } from "@/lib/ui/people";
import { relativeTimeHe } from "@/lib/ui/format";

export interface ChatSearchHit {
  id: string;
  createdAt: string;
  content: string;
  sender: string;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

// The search text inside a snippet, marked. Case-insensitive; niqqud in the
// message is not matched specially (searching is done by the server).
function highlight(text: string, q: string) {
  const needle = q.trim();
  if (!needle) return text;
  const lower = text.toLowerCase();
  const n = needle.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let i = lower.indexOf(n); i !== -1; i = lower.indexOf(n, i + n.length)) {
    parts.push(text.slice(from, i));
    parts.push(
      <mark key={i} className="rounded-sm bg-warning-soft px-0.5 text-foreground">
        {text.slice(i, i + n.length)}
      </mark>,
    );
    from = i + n.length;
  }
  parts.push(text.slice(from));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

// A snippet around the first match, so a long message shows the relevant part.
function snippet(text: string, q: string): string {
  const flat = text.replace(/\s+/g, " ");
  const i = flat.toLowerCase().indexOf(q.trim().toLowerCase());
  if (i < 0 || flat.length <= 120) return flat.slice(0, 120);
  const start = Math.max(0, i - 40);
  return `${start > 0 ? "…" : ""}${flat.slice(start, start + 120)}…`;
}

// "חיפוש בשיחה" (client QA 12.11.2026): the bar above a chat (study room or
// private chat). Results newest first; picking one (or ↑/↓) jumps to it in
// the thread — loading older messages if needed is the caller's job.
export function ChatSearch({
  search,
  onPick,
  onClose,
}: {
  search: (q: string) => Promise<{ ok: boolean; error?: string; hits?: ChatSearchHit[] }>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  // The answer for one query; stale while the box holds a different text.
  const [result, setResult] = useState<{
    q: string;
    hits: ChatSearchHit[] | null;
    error: string | null;
  } | null>(null);
  const [index, setIndex] = useState(-1);
  const text = q.trim();
  const searchable = normalizeSearch(text).length >= MIN_CHARS;
  const current = searchable && result?.q === text ? result : null;
  const hits = current?.hits ?? null;
  const error = current?.error ?? null;
  const loading = searchable && !current;
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchRef.current(text);
      if (cancelled) return;
      setIndex(-1);
      setResult(
        r.ok
          ? { q: text, hits: r.hits ?? [], error: null }
          : { q: text, hits: null, error: r.error ?? "החיפוש נכשל" },
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, searchable]);

  function pick(i: number) {
    if (!hits || i < 0 || i >= hits.length) return;
    setIndex(i);
    onPick(hits[i].id);
  }

  return (
    <div className="flex flex-col gap-2 border-b border-divider px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2">
        <label className="flex h-10 min-w-0 grow items-center gap-2 rounded-xl bg-surface-2 px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-primary-line">
          {loading ? (
            <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <SearchIcon className="size-4 shrink-0" aria-hidden />
          )}
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter") pick(index + 1 < (hits?.length ?? 0) ? index + 1 : 0);
            }}
            placeholder="חיפוש בשיחה…"
            aria-label="חיפוש הודעות בשיחה"
            className="min-w-0 grow bg-transparent text-sm text-foreground outline-none"
          />
        </label>
        {hits && hits.length > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
            <span aria-live="polite" className="px-1 tabular-nums">
              {index >= 0 ? `${index + 1}/${hits.length}` : `${hits.length} תוצאות`}
            </span>
            <button
              type="button"
              aria-label="תוצאה קודמת (ישנה יותר)"
              onClick={() => pick(Math.min(hits.length - 1, index + 1))}
              className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-2"
            >
              <ChevronUpIcon className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="תוצאה הבאה (חדשה יותר)"
              onClick={() => pick(Math.max(0, index - 1))}
              className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-2"
            >
              <ChevronDownIcon className="size-4" aria-hidden />
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירת החיפוש"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      </div>

      {error && <p className="text-xs text-rose-ink">{error}</p>}
      {hits && hits.length === 0 && (
        <p className="text-xs text-muted-foreground">לא נמצאו הודעות עם „{q.trim()}“</p>
      )}
      {hits && hits.length > 0 && (
        <ul className="flex max-h-56 flex-col overflow-y-auto rounded-xl border border-border">
          {hits.map((h, i) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => pick(i)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-divider px-3 py-2 text-start last:border-b-0 hover:bg-surface-2",
                  i === index && "bg-primary-soft",
                )}
              >
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold">{h.sender}</span>
                  <span className="text-muted-foreground">{relativeTimeHe(h.createdAt)}</span>
                </span>
                <span className="text-[13px] leading-snug">
                  {highlight(snippet(h.content, q), q)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
