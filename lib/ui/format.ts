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
  const key = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
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

// A datetime-local value ("2026-10-25T18:00") read as Israel wall-clock time
// → ISO instant, whatever the viewer's own time zone (sessions are shown in
// Israel time everywhere).
export function israelLocalToIso(value: string): string {
  const [date, time] = value.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  const offsetAt = (at: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(new Date(at))
        .map((p) => [p.type, p.value]),
    );
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - at;
  };
  // Twice: the first guess may sit on the other side of a DST change.
  const guess = wall - offsetAt(wall);
  return new Date(wall - offsetAt(guess)).toISOString();
}

// "Last seen" of a student (client QA 11.2026): "מחובר/ת עכשיו" inside the
// online window, else "התחבר/ה לפני שעתיים" / "...לפני יום" — whole units,
// rounded down (logged in yesterday 12:00, now 12:00 → "לפני יום").
const ONLINE_MS = 5 * 60_000;

function agoHe(n: number, one: string, two: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${many}`;
}

export function lastSeenHe(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "עוד לא התחבר/ה";
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < ONLINE_MS) return "מחובר/ת עכשיו";
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let ago: string;
  if (minutes < 60) ago = agoHe(minutes, "דקה", "2 דקות", "דקות");
  else if (hours < 24) ago = agoHe(hours, "שעה", "שעתיים", "שעות");
  else if (days < 7) ago = agoHe(days, "יום", "יומיים", "ימים");
  else if (days < 30) ago = agoHe(Math.floor(days / 7), "שבוע", "שבועיים", "שבועות");
  else if (days < 365) ago = agoHe(Math.floor(days / 30), "חודש", "חודשיים", "חודשים");
  else return "התחבר/ה לפני יותר משנה";
  return `התחבר/ה לפני ${ago}`;
}
