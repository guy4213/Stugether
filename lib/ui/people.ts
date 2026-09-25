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
