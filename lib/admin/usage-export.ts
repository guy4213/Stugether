import "server-only";
import { buildXlsx, type Sheet } from "@/lib/export/xlsx";
import type { AdminUsage } from "@/lib/admin/queries";

// "ייצוא ל-Excel" on /admin/usage: the same counts the page shows, one sheet
// per table. Counts, names and costs only — never message content.

export const WEEKDAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function change(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "חדש" : "—";
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

export function usageWorkbook(usage: AdminUsage, generatedAt: Date): Buffer {
  const { totals, previous, days } = usage;
  const period = `${days} הימים האחרונים (עד ${usage.daily.at(-1)?.day ?? ""})`;

  const summaryRows: [string, number, number | null, string, boolean][] = [
    ["משתמשים פעילים", totals.activeUsers, null, "", false],
    ["הצטרפו", totals.signups, previous.signups, change(totals.signups, previous.signups), false],
    [
      "חדרים חדשים",
      totals.roomsCreated,
      previous.roomsCreated,
      change(totals.roomsCreated, previous.roomsCreated),
      false,
    ],
    [
      "הודעות בחדרים",
      totals.roomMessages,
      previous.roomMessages,
      change(totals.roomMessages, previous.roomMessages),
      false,
    ],
    [
      "הודעות פרטיות",
      totals.directMessages,
      previous.directMessages,
      change(totals.directMessages, previous.directMessages),
      false,
    ],
    ["ריצות AI", totals.aiRuns, previous.aiRuns, change(totals.aiRuns, previous.aiRuns), false],
    ["ריצות AI שנכשלו", totals.aiFailed, previous.aiFailed, "", false],
    ["טוקנים", totals.tokens, previous.tokens, change(totals.tokens, previous.tokens), false],
    [
      "עלות AI מוערכת",
      totals.costUsd,
      previous.costUsd,
      change(totals.costUsd, previous.costUsd),
      true,
    ],
  ];

  const sheets: Sheet[] = [
    {
      name: "סיכום",
      columns: [
        { header: "מדד", width: 22 },
        { header: "בתקופה", width: 14 },
        { header: "בתקופה הקודמת", width: 16 },
        { header: "שינוי", width: 10 },
      ],
      rows: [
        ...summaryRows.map(([label, cur, prev, delta, money]) => [
          label,
          money ? Math.round(cur * 100) / 100 : cur,
          prev === null ? null : money ? Math.round(prev * 100) / 100 : prev,
          delta,
        ]),
        [],
        ["תקופה", period],
        ["הופק", generatedAt.toISOString().slice(0, 16).replace("T", " ") + " UTC"],
        ["הערה", "ספירות בלבד, בלי תוכן הודעות. העלות היא הערכה לפי מחירון Gemini"],
      ],
    },
    {
      name: "יומי",
      columns: [
        { header: "יום", width: 12 },
        { header: "פעילים", width: 10 },
        { header: "הצטרפו", width: 10 },
        { header: "הודעות בחדרים", width: 15 },
        { header: "הודעות פרטיות", width: 15 },
        { header: "חדרים חדשים", width: 13 },
        { header: "ריצות AI", width: 11 },
        { header: "נכשלו", width: 9 },
        { header: "טוקנים", width: 12 },
        { header: "עלות AI", width: 11, currency: true },
      ],
      rows: [...usage.daily]
        .reverse()
        .map((d) => [
          d.day,
          d.activeUsers,
          d.signups,
          d.roomMessages,
          d.directMessages,
          d.roomsCreated,
          d.aiRuns,
          d.aiFailed,
          d.tokens,
          d.costUsd,
        ]),
    },
    {
      name: "קורסים מובילים",
      columns: [
        { header: "קורס", width: 34 },
        { header: "קוד", width: 12 },
        { header: "חדרים חדשים", width: 13 },
        { header: "חדרים פעילים", width: 13 },
        { header: "הודעות", width: 10 },
        { header: "ריצות AI", width: 11 },
        { header: "עלות AI", width: 11, currency: true },
      ],
      rows: usage.topCourses.map((c) => [
        c.name,
        c.code,
        c.roomsCreated,
        c.activeRooms,
        c.messages,
        c.aiRuns,
        c.costUsd,
      ]),
    },
    {
      name: "משתמשים פעילים",
      columns: [
        { header: "משתמש/ת", width: 26 },
        { header: "הודעות בחדרים", width: 15 },
        { header: "הודעות פרטיות", width: 15 },
        { header: "ריצות AI", width: 11 },
      ],
      rows: usage.topUsers.map((u) => [u.fullName, u.roomMessages, u.directMessages, u.aiRuns]),
    },
    {
      name: "צרכני AI",
      columns: [
        { header: "משתמש/ת", width: 26 },
        { header: "ריצות", width: 9 },
        { header: "נכשלו", width: 9 },
        { header: "טוקנים", width: 12 },
        { header: "עלות", width: 11, currency: true },
      ],
      rows: usage.topAiUsers.map((u) => [u.fullName, u.aiRuns, u.aiFailed, u.tokens, u.costUsd]),
    },
  ];

  if (usage.heatmap) {
    const grid = WEEKDAYS_HE.map(() => Array<number>(24).fill(0));
    for (const c of usage.heatmap) grid[c.dow][c.hour] = c.n;
    sheets.push({
      name: "שעות פעילות",
      columns: [
        { header: "יום", width: 9 },
        ...Array.from({ length: 24 }, (_, h) => ({ header: `${h}:00`, width: 6 })),
      ],
      rows: grid.map((hours, dow) => [WEEKDAYS_HE[dow], ...hours]),
    });
  }

  return buildXlsx(sheets, { rtl: true });
}
