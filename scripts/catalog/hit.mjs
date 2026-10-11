// scripts/catalog/hit.mjs
// Builds supabase/catalog/hit.json from HIT's public faculty handbooks
// (ידיעונים, https://www.hit.ac.il/students/regulations-newsletters/).
//
//   node scripts/catalog/hit.mjs                 # fetch the handbooks
//   node scripts/catalog/hit.mjs --cache <dir>   # reuse/save raw HTML in <dir>
//
// What it extracts, per bachelor's department already in the catalog:
//   - every course in the course tables: code, name, credits, year, semester,
//     prerequisite codes (electives have no year/semester);
//   - for faculties that publish course summaries (תקצירי קורסים): the course
//     goals as a description and its "נושאים" list as the official topics.
// Master's programs, the high-school track and staff tables are skipped.
//
// Only facts are kept (names, numbers, topic titles) — no lecturer names, no
// copied prose beyond a short description. Re-run each academic year.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitTopics } from "./lib/topics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "supabase/catalog/hit.json");
const BASE = "https://www.hit.ac.il";
const USER_AGENT = "Stugether-catalog/1.0 (+https://github.com/guy4213/Stugether)";

// department: name exactly as seeded in 20260930000002 (H.IT).
// section(h2, acc) → department name | null (skip).
const HANDBOOKS = [
  {
    path: "/students/regulations-newsletters/yedion-sciences/",
    section: (h2, acc) => {
      if (/תואר שני|M\.Sc|מצוינוער/.test(acc)) return null;
      if (h2.includes("מדעי המתמטיקה")) return "מתמטיקה שימושית";
      if (h2.includes("מדעי המחשב")) return "מדעי המחשב";
      return null;
    },
  },
  {
    path: "/yedion-engineering/",
    section: (h2) => (h2.includes("תואר ראשון") ? "הנדסת חשמל ואלקטרוניקה" : null),
  },
  {
    path: "/students/regulations-newsletters/yedion-nahat/",
    section: (h2) => (h2.includes("תואר ראשון") ? "הנדסת תעשייה וניהול טכנולוגיה" : null),
  },
  {
    path: "/students/regulations-newsletters/yedion-telem/",
    section: (h2) =>
      h2.includes("תואר ראשון") || h2.includes("תקצירי סמינרים") ? "טכנולוגיות למידה" : null,
  },
  {
    path: "/students/regulations-newsletters/yedion-dmt2025-2026/",
    section: () => "טכנולוגיות רפואיות דיגיטליות",
  },
  {
    path: "/students/regulations-newsletters/yedion-design/",
    section: (h2, acc) => {
      if (!h2.includes("תואר ראשון") && !h2.includes("תערוכות")) return null;
      if (acc.includes("עיצוב פנים")) return "עיצוב פנים";
      if (acc.includes("עיצוב תעשייתי")) return "עיצוב תעשייתי";
      if (acc.includes("תקשורת חזותית")) return "עיצוב תקשורת חזותית";
      return null;
    },
  },
];

// ---------------------------------------------------------------------------
// HTML helpers (the pages are WordPress output; no DOM parser needed)
// ---------------------------------------------------------------------------
const ENTITIES = { nbsp: " ", ndash: "–", mdash: "—", quot: '"', amp: "&", lt: "<", gt: ">" };

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? m);
}

function text(html) {
  return decode(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function rowsOf(tableHtml) {
  return [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) =>
    [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => text(c[1])),
  );
}

const CODE = /^\d{5}$/;
const HEBREW_ORDINAL = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5 };

// Faculties label tables differently: "שנה א' │ סמסטר א'", "שנה א' | סמסטר ב'",
// "טבלה 7: שנה ג' סמסטר ב'", "שנה ב' - סמסטר א'". The last label wins.
function parseYearSemester(label) {
  const m = [...label.matchAll(/שנה\s+([א-ה])['׳]?\s*[|│:\-–]?\s*סמסטר\s+(א|ב|קיץ)/g)].at(-1);
  if (!m) return null;
  const semester = m[2] === "קיץ" ? "סמסטר קיץ" : `סמסטר ${m[2]}׳`;
  return { year: HEBREW_ORDINAL[m[1]], semester };
}

function toNumber(cell) {
  const n = Number.parseFloat((cell ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Course tables differ by faculty (some split "סוג שיעור" into ש'/ת'/מ', some
// put credits before hours), so locate the credits column from the header
// row, relative to the course-name column.
function creditsOffset(rows) {
  const header = rows.find((r) => r.some((c) => /מס(פר|')\s*(ה)?(קורס|שיעור)/.test(c)));
  if (!header) return null;
  const nameIdx = header.findIndex((c) => /^שם (ה)?(קורס|שיעור)$|^קורס$/.test(c));
  if (nameIdx < 0) return null;
  const splitTypes = rows.some((r) => r[0] === "ש'" || r[0] === "ש׳");
  let offset = 0;
  for (const cell of header.slice(nameIdx + 1)) {
    if (/נ"?ז|נקודות/.test(cell)) return offset;
    offset += cell === "סוג שיעור" && splitTypes ? 3 : 1;
  }
  return null;
}

function parseCourseTable(tableHtml, context) {
  const rows = rowsOf(tableHtml);
  const offset = creditsOffset(rows);
  const courses = [];
  for (const row of rows) {
    const c = row.findIndex((cell) => CODE.test(cell));
    if (c < 0 || c > 1) continue; // code is the first column (after an optional "area" column)
    const name = row[c + 1]?.replace(/\s*\(.*?נ"ז.*?\)\s*$/, "").trim();
    if (!name || CODE.test(name) || !/[א-תA-Za-z]{2}/.test(name)) continue;
    if (/^(חובה|בחירה)$/.test(name)) continue; // a column label, not a course
    const credits = offset === null ? null : toNumber(row[c + 2 + offset]);
    const prereqCells = offset === null ? [] : row.slice(c + 3 + offset);
    const prerequisites = [...new Set(prereqCells.join(" ").match(/\b\d{5}\b/g) ?? [])];
    courses.push({ code: row[c], name, credits, ...context, prerequisites });
  }
  return courses;
}

// "תקצירי קורסים": blocks separated by <hr>, each opening with
// "<code> – <name>", then labelled sections (מטרות / נושאים / ...).
function parseSummaries(html) {
  const out = new Map();
  for (const block of html.split(/<hr\s*\/?>/i)) {
    const head = text(block.slice(0, 400)).match(/(\d{5})\s*[–-]\s*/);
    if (!head) continue;
    const code = head[1];
    const sections = splitSections(block);
    // List items stay one topic each ("; " keeps their inner commas); a
    // paragraph goes through the shared splitter.
    const topics = splitTopics((sections.get("נושאים") ?? []).join("; "));
    const goals = sections.get("מטרות") ?? sections.get("מטרת הקורס") ?? [];
    if (topics.length === 0 && goals.length === 0) continue;
    out.set(code, {
      description: goals.join(" ").slice(0, 1000) || null,
      topics,
    });
  }
  return out;
}

// Returns label → list of items. Items come from <li>, "•" lines, or plain
// paragraphs under the label.
function splitSections(block) {
  const sections = new Map();
  const labelRe = /<strong>\s*([^<]{2,40}?)\s*:?\s*<\/strong>/g;
  const marks = [...block.matchAll(labelRe)].map((m) => ({
    label: decode(m[1]).replace(/:$/, "").trim(),
    start: m.index + m[0].length,
    at: m.index,
  }));
  marks.forEach((mark, i) => {
    const body = block.slice(mark.start, marks[i + 1]?.at ?? block.length);
    const lis = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
    const items =
      lis.length > 0
        ? lis
        : text(body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n"))
            .split(/\s*•\s*/)
            .map((s) => s.trim())
            .filter(Boolean);
    if (items.length > 0 && !sections.has(mark.label)) sections.set(mark.label, items);
  });
  return sections;
}

// Walks headings and tables in document order, tracking the current h2,
// accordion title and "שנה X │ סמסטר Y" heading.
function parseHandbook(html, handbook) {
  const re =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<button[^>]*accordion-button[^>]*>([\s\S]*?)<\/button>|<h[34][^>]*>([\s\S]*?)<\/h[34]>|<table[\s\S]*?<\/table>|<div[^>]*accordion-body[^>]*>/g;
  let h2 = "";
  let acc = "";
  let sub = "";
  let when = null;
  let lastTableEnd = 0;
  const courses = [];
  const summaries = new Map();
  const summaryStarts = [];
  for (let m; (m = re.exec(html));) {
    if (m[1] !== undefined) {
      h2 = text(m[1]);
      acc = sub = "";
      when = null;
    } else if (m[2] !== undefined) {
      acc = text(m[2]);
      sub = "";
      when = null;
    } else if (m[3] !== undefined) {
      sub = text(m[3]);
      when = parseYearSemester(sub) ?? (sub ? when : when);
    } else if (m[0].startsWith("<table")) {
      // The year/semester label sits in whatever element precedes the table.
      when = parseYearSemester(text(html.slice(lastTableEnd, m.index))) ?? when;
      lastTableEnd = m.index + m[0].length;
      const department = handbook.section(h2, acc);
      if (!department) continue;
      const elective = /בחירה/.test(acc + " " + sub);
      courses.push(
        ...parseCourseTable(m[0], {
          department,
          year_level: elective ? null : (when?.year ?? null),
          semester: elective ? null : (when?.semester ?? null),
          elective,
        }),
      );
    } else if (/תקציר/.test(acc) && handbook.section(h2, acc)) {
      summaryStarts.push(m.index);
    }
  }
  for (const start of summaryStarts) {
    const end = html.indexOf('class="accordion-item', start);
    for (const [code, s] of parseSummaries(html.slice(start, end < 0 ? undefined : end))) {
      if (!summaries.has(code)) summaries.set(code, s);
    }
  }
  return { courses, summaries };
}

// ---------------------------------------------------------------------------
async function fetchHandbook(handbook, cacheDir) {
  const file = cacheDir && path.join(cacheDir, path.basename(handbook.path) + ".html");
  if (file && existsSync(file)) return readFile(file, "utf8");
  const res = await fetch(BASE + handbook.path, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${handbook.path}: HTTP ${res.status}`);
  const html = await res.text();
  if (file) {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, html);
  }
  await new Promise((r) => setTimeout(r, 1000)); // be polite
  return html;
}

async function main() {
  const cacheIdx = process.argv.indexOf("--cache");
  const cacheDir = cacheIdx > 0 ? path.resolve(process.argv[cacheIdx + 1]) : null;

  const byDept = new Map();
  for (const handbook of HANDBOOKS) {
    const html = await fetchHandbook(handbook, cacheDir);
    const academicYear = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "").match(
      /תשפ"?[א-ת]/,
    )?.[0];
    const { courses, summaries } = parseHandbook(html, handbook);
    for (const course of courses) {
      const dept = byDept.get(course.department) ?? new Map();
      byDept.set(course.department, dept);
      const existing = dept.get(course.code);
      // First occurrence wins (regular track before flexible track / electives),
      // but a later mandatory placement beats an elective listing.
      if (existing && !(existing.elective && !course.elective)) continue;
      const summary = summaries.get(course.code);
      dept.set(course.code, {
        code: course.code,
        name: course.name,
        credits: course.credits,
        year_level: course.year_level,
        semester: course.semester,
        elective: course.elective,
        prerequisites: course.prerequisites,
        description: summary?.description ?? existing?.description ?? null,
        topics: summary?.topics ?? existing?.topics ?? [],
        source_url: BASE + handbook.path,
        academic_year: academicYear ?? null,
      });
    }
    // Summaries for courses that only appear in summaries (e.g. electives
    // listed by name elsewhere) are attached when the code matches above.
    console.error(
      `${handbook.path}: ${courses.length} rows, ${summaries.size} summaries (${academicYear ?? "?"})`,
    );
  }

  const departments = [...byDept.entries()].map(([name, courses]) => ({
    name,
    courses: [...courses.values()].sort(
      (a, b) =>
        (a.year_level ?? 99) - (b.year_level ?? 99) ||
        (a.semester ?? "").localeCompare(b.semester ?? "", "he") ||
        a.code.localeCompare(b.code),
    ),
  }));

  const catalog = {
    institution: "H.IT",
    source: `${BASE}/students/regulations-newsletters/`,
    generated_at: new Date().toISOString().slice(0, 10),
    departments,
  };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(catalog, null, 2) + "\n");

  for (const d of departments) {
    const withTopics = d.courses.filter((c) => c.topics.length > 0).length;
    console.error(`  ${d.name}: ${d.courses.length} courses, ${withTopics} with official topics`);
  }
  console.error(`→ ${path.relative(ROOT, OUT)}`);
}

await main();
