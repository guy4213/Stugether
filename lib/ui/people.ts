import { hashString } from "@/lib/ui/tones";

export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("");
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

// Initials avatars in the mockup cycle through these tint/ink pairs.
const PERSON_TONES = [
  "bg-rose-soft text-rose-ink",
  "bg-[#ddebff] text-primary-strong",
  "bg-success-soft text-success-ink",
  "bg-violet-soft text-violet-ink",
  "bg-warning-soft text-warning-ink",
  "bg-sky-soft text-sky-ink",
];

export function personTone(id: string): string {
  return PERSON_TONES[hashString(id) % PERSON_TONES.length];
}

// Hebrew has no neutral form; the app writes both, as the mockup does.
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isOnline(lastSeenAt: string | null | undefined, now = Date.now()): boolean {
  return !!lastSeenAt && now - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

// Search text, normalised: lowercase, no niqqud, no geresh / gershayim /
// quotes, single spaces — "ג׳ני" matches "גני", "נֹעָה" matches "נעה".
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'׳״`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Client-side filter for a student list already on screen (client QA
// 11.2026: "חיפוש סטודנט בכל רשימת סטודנטים"). Every word of the query has to
// appear in one of the fields.
export function filterPeople<T>(
  list: T[],
  query: string,
  fields: (item: T) => (string | null | undefined)[],
): T[] {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (words.length === 0) return list;
  return list.filter((item) => {
    const hay = normalizeSearch(fields(item).filter(Boolean).join(" "));
    return words.every((w) => hay.includes(w));
  });
}
