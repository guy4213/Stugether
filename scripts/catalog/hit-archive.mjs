// scripts/catalog/hit-archive.mjs
// Builds supabase/catalog/hit-archive.json: per-course topic lists from HIT's
// own syllabus books (סילבוסים), which HIT published as PDFs until ~2024 and
// later removed. The copies come from the Internet Archive (Wayback Machine).
//
//   node scripts/catalog/hit-archive.mjs --cache <dir>
//
// Requires `pdftotext` (poppler) on PATH. Course codes are HIT's own, so the
// enrich step matches these by code, not by name. Newer books win.

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitTopics } from "./lib/topics.mjs";
import { pdfText } from "./lib/pdf.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "supabase/catalog/hit-archive.json");
const USER_AGENT = "Stugether-catalog/1.0 (+https://github.com/guy4213/Stugether)";
const ORIGIN = "https://www.hit.ac.il/.upload/Academics/Yedion/";

// Newest first. [wayback timestamp, path under ORIGIN, academic year].
const BOOKS = [
  ["20240601160150", "2023-2024/nahat.pdf", 'תשפ"ד'],
  ["20220107163825", "2021-2022/Computer_Science_Syllabus.pdf", 'תשפ"א'],
  ["20220107164238", "2021-2022/Maths_Syllabus.pdf", 'תשפ"א'],
  ["20220107163834", "2021-2022/Physics_syllabus.pdf", 'תשפ"א'],
  ["20180516201257", "2017-2018/engineering.pdf", 'תשע"ח'],
  ["20150402073841", "2014-2015/Engineering_Syllabus_bsc.pdf", 'תשע"ה'],
  // Design was renumbered in 2013-14 and this book's header font garbles the
  // codes, so its courses are matched by name only (the "by_name" list).
  ["20130121232727", "2012/silabus2012_design.pdf", 'תשע"ב', { byName: true }],
];

const waybackUrl = (ts, file) => `https://web.archive.org/web/${ts}id_/${ORIGIN}${file}`;

// "- 50016מעגלים ספרתיים Digital Circuits" / "– 20020הסתברות לניהול טכנולוגיה –"
// / "77703 סמינר תלמידים – ... Master thesis".
const HEADER = /^\s*[-–]?\s*(\d{5})\s*[-–]?\s*([\u0590-\u05FF][^\n]*)$/gm;
const TOPICS_START =
  /(הנושאים שי?ילמדו בקורס|נושאי הלימוד|נושאי הקורס|תוכן הקורס|תכני הקורס|נושאים)\s*[:8]/; // the 2012 design font prints ":" as "8"
const TOPICS_END =
  /(ספרי לימוד|ספרי עיון|ספרות|ביבליוגרפיה|רשימת קריאה|דרישות הקורס|חובות הקורס|מרכיבי הציון|הרכב הציון|דרך ההערכה|אופן ההערכה|מטלות)\s*:?/;

function hebrewName(rest) {
  // Name ends where the English title (or a trailing dash) starts.
  const name = rest
    .split(/\s[-–]\s|\s(?=[A-Za-z]{2,})/)[0]
    .replace(/[\s\-–]+$/, "")
    .trim();
  // A part number can survive only in the English title: "יסודות העיצוב Basic Design 2".
  const part = rest.match(/[A-Za-z][A-Za-z&,' ]*\s(\d)\b/)?.[1];
  return part && !/\d/.test(name) ? `${name} ${part}` : name;
}

// IE books put the name on its own line and the code below it:
// "הנדסת שיטות Engineering of Methods\nמספר הקורס70093 :".
const NAMED_HEADER = /^([^\n]*[\u0590-\u05FF][^\n]*)\n\s*מספר הקורס\s*:?\s*(\d{5})\s*:?/gm;
const GOAL = /מטר(ת|ות) הקורס\s*:?/;

const oneLine = (s) => s.replace(/\s+/g, " ").trim();

function section(body, startRe) {
  const start = body.match(startRe);
  if (!start) return null;
  let rest = body.slice(start.index + start[0].length);
  const end = rest.match(new RegExp(`${TOPICS_END.source}|${TOPICS_START.source}`));
  if (end) rest = rest.slice(0, end.index);
  return oneLine(rest);
}

function parseBook(text) {
  const headers = [
    ...[...text.matchAll(HEADER)].map((m) => ({
      at: m.index,
      end: m.index + m[0].length,
      code: m[1],
      name: hebrewName(m[2]),
    })),
    ...[...text.matchAll(NAMED_HEADER)].map((m) => ({
      at: m.index,
      end: m.index + m[0].length,
      code: m[2],
      name: hebrewName(m[1]),
    })),
  ]
    // A real entry opens with its details block; codes inside prerequisite
    // lines and timetable rows look like headers but are not followed by one.
    .filter((h) => {
      const after = text.slice(h.end, h.end + 300);
      const details = after.search(/אופן (ה)?הוראה|שעות שבועיות|נקודות זכות/);
      const content = after.search(/מטר(ת|ות) הקורס|הנושאים|דרישות קדם/);
      return details >= 0 && (content < 0 || details < content);
    })
    .sort((a, b) => a.at - b.at);

  // A code can still repeat (a prerequisite line right before the next
  // entry); keep the richest candidate.
  const courses = new Map();
  headers.forEach((h, i) => {
    if (h.name.length < 2) return;
    const body = text.slice(h.end, headers[i + 1]?.at ?? text.length);
    const topics = splitTopics(section(body, TOPICS_START));
    // The goal paragraph is prose: kept as the description, never split into topics.
    const description = section(body, GOAL)?.slice(0, 1000) || null;
    if (topics.length === 0 && !description) return;
    const prev = courses.get(h.code);
    if (prev && prev.topics.length >= topics.length) return;
    courses.set(h.code, { code: h.code, name: h.name, description, topics });
  });
  return courses;
}

async function fetchBook(ts, file, cacheDir) {
  const local = path.join(cacheDir, file.replaceAll("/", "_"));
  if (!existsSync(local)) {
    const res = await fetch(waybackUrl(ts, file), { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    await writeFile(local, Buffer.from(await res.arrayBuffer()));
    await new Promise((r) => setTimeout(r, 2000)); // the archive is a shared resource
  }
  return pdfText(local);
}

async function main() {
  const cacheIdx = process.argv.indexOf("--cache");
  const cacheDir = path.resolve(
    cacheIdx > 0 ? process.argv[cacheIdx + 1] : path.join(ROOT, "supabase/catalog/.cache"),
  );
  await mkdir(cacheDir, { recursive: true });

  const courses = {};
  const byName = [];
  for (const [ts, file, year, opts = {}] of BOOKS) {
    const parsed = parseBook(await fetchBook(ts, file, cacheDir));
    if (opts.byName) {
      for (const course of parsed.values()) {
        if (course.topics.length === 0) continue;
        byName.push({
          name: course.name,
          topics: course.topics,
          academic_year: year,
          source_url: waybackUrl(ts, file),
        });
      }
      console.error(`${file}: ${byName.length} courses with topics (matched by name)`);
      continue;
    }
    let added = 0;
    for (const [code, course] of parsed) {
      if (courses[code]) continue; // a newer book already has it
      courses[code] = { ...course, academic_year: year, source_url: waybackUrl(ts, file) };
      added++;
    }
    console.error(`${file}: ${parsed.size} courses with topics (${added} new)`);
  }

  const out = {
    institution: "H.IT",
    note: "Topic lists from HIT's archived syllabus books (Internet Archive copies).",
    generated_at: new Date().toISOString().slice(0, 10),
    courses,
    // Courses whose codes are not reliable; enrich.mjs matches these by name.
    by_name: byName,
  };
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.error(`→ ${path.relative(ROOT, OUT)} (${Object.keys(courses).length} courses)`);
}

await main().catch(async (err) => {
  console.error(err.message);
  process.exitCode = 1;
});
