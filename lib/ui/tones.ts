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

// Match percent as a traffic light (client QA 11.2026): 80+ green,
// 60-79 orange, below 60 red. One source for every match badge and ring.
export type MatchLevel = "high" | "mid" | "low";

export function matchLevel(percent: number): MatchLevel {
  if (percent >= 80) return "high";
  if (percent >= 60) return "mid";
  return "low";
}

// Solid badge (white text).
export const MATCH_SOLID: Record<MatchLevel, string> = {
  high: "bg-linear-to-b from-[#22c55e] to-[#15803d]",
  mid: "bg-linear-to-b from-[#fb923c] to-[#c2410c]",
  low: "bg-linear-to-b from-[#f87171] to-[#b91c1c]",
};

// Soft badge (tinted background, dark text, matching border).
export const MATCH_SOFT: Record<MatchLevel, string> = {
  high: "border-success bg-success-soft text-success-ink",
  mid: "border-warning bg-warning-soft text-warning-ink",
  low: "border-rose bg-rose-soft text-rose-ink",
};

export const MATCH_GRADIENT: Record<MatchLevel, [string, string]> = {
  high: ["#22c55e", "#15803d"],
  mid: ["#fb923c", "#c2410c"],
  low: ["#f87171", "#b91c1c"],
};
