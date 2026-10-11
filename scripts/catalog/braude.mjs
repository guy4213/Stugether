// scripts/catalog/braude.mjs
// Braude College (info.braude.ac.il) as an equivalent-course source. Braude
// is an engineering college much like HIT, and publishes a syllabus PDF per
// course with a numbered "נושאי הלימוד" list.
//
// Exported:
//   loadBraudeIndex(cacheDir)        → [{ code, name }]  (public A–Z course index)
//   loadBraudeTopics(code, cacheDir) → topic text or null (one PDF, cached)
//
// Requires pdftotext. Requests are spaced out and every download is cached.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pdfText } from "./lib/pdf.mjs";

const BASE = "https://info.braude.ac.il";
const SEARCH = `${BASE}/yedion/fireflyweb.aspx`;
const USER_AGENT = "Stugether-catalog/1.0 (+https://github.com/guy4213/Stugether)";
const LETTERS = [..."אבגדהוזחטיכלמנסעפצקרשת"];
const YEARS = [2026, 2025, 2024]; // newest syllabus first
const DELAY_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The search pages need the session cookie the entry page sets.
async function session() {
  const res = await fetch(`${SEARCH}?prgname=Enter_Search`, {
    headers: { "User-Agent": USER_AGENT },
  });
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

export async function loadBraudeIndex(cacheDir) {
  const file = path.join(cacheDir, "braude-index.json");
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));

  const cookie = await session();
  const courses = new Map();
  for (const letter of LETTERS) {
    const url = `${SEARCH}?prgname=S_LOOK_FOR_NOSE_AB&arguments=${encodeURIComponent(`-N${letter}`)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: cookie,
        Referer: `${SEARCH}?prgname=Enter_Search`,
      },
    });
    await sleep(DELAY_MS);
    if (!res.ok) continue;
    const cells = (await res.text())
      .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    // Rows read: code | name | "נלמד" | ...
    cells.forEach((cell, i) => {
      if (/^\d{5,6}$/.test(cell) && cells[i + 1] && !/^\d/.test(cells[i + 1])) {
        courses.set(cell, { code: cell, name: cells[i + 1] });
      }
    });
  }
  const list = [...courses.values()];
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify(list));
  console.error(`braude: ${list.length} courses in the index`);
  return list;
}

const START = /(נושאי הלימוד|נושאי הקורס|תוכן הקורס|פירוט נושאי הלימוד)\s*:/;
const END = /(ספרות|ספרי|ביבליוגרפיה|דרישות|מטלות|הערכה|ציון|הרכב|חתימה|אישורים)\s*:?/;

export async function loadBraudeTopics(code, cacheDir) {
  const dir = path.join(cacheDir, "braude");
  const textFile = path.join(dir, `${code}.txt`);
  let text = existsSync(textFile) ? await readFile(textFile, "utf8") : null;
  if (text === null) {
    text = "";
    await mkdir(dir, { recursive: true });
    for (const year of YEARS) {
      const res = await fetch(`${BASE}/info/${year}/${code.padStart(7, "0")}.pdf`, {
        headers: { "User-Agent": USER_AGENT },
      });
      await sleep(DELAY_MS);
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) continue;
      const pdf = path.join(dir, `${code}.pdf`);
      await writeFile(pdf, Buffer.from(await res.arrayBuffer()));
      text = pdfText(pdf);
      break;
    }
    await writeFile(textFile, text);
  }
  const start = text.match(START);
  if (!start) return null;
  let rest = text.slice(start.index + start[0].length);
  const end = rest.match(END);
  if (end) rest = rest.slice(0, end.index);
  return rest.replace(/\s+/g, " ").trim() || null;
}
