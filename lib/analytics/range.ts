// The progress tab's time range (?range=). Shared by the real query and the
// demo fixtures, so it lives apart from the server-only query module.
export type AnalyticsRange = "4w" | "8w" | "semester";

// "סמסטר" = ~20 weeks back (a semester plus exam period).
export function parseAnalyticsRange(value: string | undefined): AnalyticsRange {
  return value === "semester" || value === "4w" ? value : "8w";
}

export function rangeWeeks(range: AnalyticsRange): number {
  return range === "semester" ? 20 : range === "4w" ? 4 : 8;
}
