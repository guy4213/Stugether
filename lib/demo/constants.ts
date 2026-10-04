// Demo mode for UX/UI work (design reviews, usability tests). Shared by the
// server (fixtures, guards) and the client (the floating switcher) — no
// server-only imports here.
//
// Isolation: a demo session is a cookie, not an account. The signed-in user
// becomes a fixed fake student whose id never exists in the database, every
// page loader returns fixtures instead of querying, and every write (Server
// Actions, message/AI routes, avatar upload) refuses to run. Nothing is read
// from or written to Supabase, so real users and admin stats are untouched.

export const DEMO_COOKIE = "stugether_demo";

// Demo mode is ON by default (no cookie = demo). Regular mode is the cookie
// value "off", set by the toggle button.
export const DEMO_OFF = "off";

export const DEMO_SCENARIOS = ["active", "quiet", "empty"] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export const DEMO_SCENARIO_LABEL: Record<DemoScenario, { title: string; description: string }> = {
  active: { title: "מצב פעיל", description: "יש אנשים פנויים, חדר חי והתראות" },
  quiet: { title: "משתמשים, בלי פעילות", description: "יש סטודנטים בקורסים, אף אחד לא פנוי" },
  empty: { title: "מצב ריק", description: "אין עדיין אף אחד — חוויית ה-0" },
};

export function parseDemoScenario(value: string | undefined | null): DemoScenario | null {
  return DEMO_SCENARIOS.includes(value as DemoScenario) ? (value as DemoScenario) : null;
}

// Every demo id shares this prefix (valid uuid shape, so a stray query fails
// on "no rows", not on a parse error).
const DEMO_ID_PREFIX = "d0000000-";

export function demoId(kind: number, n: number): string {
  return `${DEMO_ID_PREFIX}0000-4000-8${String(kind).padStart(3, "0")}-${String(n).padStart(12, "0")}`;
}

export function isDemoId(id: string): boolean {
  return id.startsWith(DEMO_ID_PREFIX);
}

export const DEMO_USER_ID = demoId(0, 1);

// Entry points the switcher links to.
export const DEMO_INFI_COURSE_ID = demoId(2, 1);
export const DEMO_LIVE_ROOM_ID = demoId(5, 1);

export const DEMO_READ_ONLY_ERROR = "מצב דמו — הפעולה לא נשמרת";

// Shape every Server Action result in the app is compatible with.
export const DEMO_READ_ONLY = { ok: false, error: DEMO_READ_ONLY_ERROR } as const;

// Demo avatars are static files in public/demo/avatars, not Storage objects.
export const DEMO_AVATAR_PREFIX = "demo/avatars/";

// Canned tutor reply for messages sent in the demo room (nothing reaches Gemini).
export const DEMO_AI_REPLY = `נשמע כמו כיוון טוב! לפני שאני עונה — מה ניסיתם עד עכשיו?

- כתבו את **הצעד הראשון** שעשיתם.
- סמנו איפה בדיוק נתקעתם.

כך אוכל לכוון אתכם בלי לפתור במקומכם 🙂`;
