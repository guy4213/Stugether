const TIME_ZONE = "Asia/Jerusalem";

// "לפני 2 דק׳" / "לפני שעה" / "אתמול" / "28 באוג׳" — the mockup's relative times.
export function relativeTimeHe(iso: string, now = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "לפני שעה";
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.round(hours / 24);
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  return shortDateHe(iso);
}

// "28 באוג׳"
export function shortDateHe(iso: string): string {
  const parts = new Intl.DateTimeFormat("he-IL", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(iso));
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = (parts.find((p) => p.type === "month")?.value ?? "").replace(/[׳'.]$/, "");
  return `${day} ב${month}׳`;
}

// "10:24"
export function timeHe(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

// "חמישי"
export function weekdayHe(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { timeZone: TIME_ZONE, weekday: "long" })
    .format(new Date(iso))
    .replace(/^יום\s+/, "");
}

// "ה׳"
export function weekdayLetterHe(iso: string): string {
  const letter = new Intl.DateTimeFormat("he-IL", { timeZone: TIME_ZONE, weekday: "narrow" })
    .format(new Date(iso))
    .replace(/[׳']/g, "");
  return `${letter}׳`;
}

export function isSameIsraelDay(a: Date, b: Date): boolean {
  const key = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
  return key(a) === key(b);
}

// "היום" / "מחר" / "חמישי" for an upcoming event.
export function eventDayLabelHe(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (isSameIsraelDay(date, now)) return "היום";
  if (isSameIsraelDay(date, new Date(now.getTime() + 86_400_000))) return "מחר";
  return weekdayHe(iso);
}

// Hebrew morning/afternoon/evening greeting, in Israel time.
export function greetingHe(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hour12: false })
      .format(now)
      .replace(/\D/g, ""),
  );
  if (hour >= 5 && hour < 12) return "בוקר טוב";
  if (hour >= 12 && hour < 17) return "צהריים טובים";
  if (hour >= 17 && hour < 22) return "ערב טוב";
  return "לילה טוב";
}
