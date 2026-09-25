// Color "tones" of the StuGether Dashboard mockup. Each tone is a soft tint
// background + a foreground that keeps >=4.5:1 on it (see app/globals.css).
export type Tone = "blue" | "teal" | "success" | "warning" | "violet" | "rose" | "sky" | "neutral";

export const TONE_SOFT: Record<Tone, string> = {
  blue: "bg-primary-tint text-primary",
  teal: "bg-success-soft text-secondary",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  violet: "bg-violet-soft text-violet",
  rose: "bg-rose-soft text-rose-ink",
  sky: "bg-sky-soft text-sky",
  neutral: "bg-muted text-muted-foreground",
};

// Saturated start/end colors, for progress bars and rings of a given tone.
export const TONE_GRADIENT: Record<Tone, [string, string]> = {
  blue: ["#2563eb", "#0d9488"],
  teal: ["#0d9488", "#10b981"],
  success: ["#0d9488", "#10b981"],
  warning: ["#f59e0b", "#f97316"],
  violet: ["#6d4aff", "#2563eb"],
  rose: ["#e11d48", "#f97316"],
  sky: ["#0369a1", "#0d9488"],
  neutral: ["#5b6781", "#3a4660"],
};

export const TONE_SOLID: Record<Tone, string> = {
  blue: "#2563eb",
  teal: "#0d9488",
  success: "#10b981",
  warning: "#f59e0b",
  violet: "#6d4aff",
  rose: "#e11d48",
  sky: "#0369a1",
  neutral: "#5b6781",
};

export function hashString(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
