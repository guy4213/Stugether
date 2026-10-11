// scripts/catalog/openu.mjs
// Open University (openu.ac.il) as an equivalent-course source: its public
// course pages list each course's study units ("נושאי הלימוד" / "פרקי ...").
// robots.txt allows crawling. Pages are windows-1255 (some redirect to UTF-8
// SharePoint pages under academic.openu.ac.il).
//
// Exported:
//   loadOpenUIndex(cacheDir)           → [{ code, name }]   (~1,150 courses)
//   loadOpenUTopics(code, cacheDir)    → topic text or null (one page, cached)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const INDEX = "https://www3.openu.ac.il/ouweb/owal/catalog.sknum?v_last=";
const COURSE = "https://www.openu.ac.il/courses/";
const USER_AGENT = "Stugether-catalog/1.0 (+https://github.com/guy4213/Stugether)";
const DELAY_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow" });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const type = res.headers.get("content-type") ?? "";
  const utf8 = /utf-?8/i.test(type) || res.url.includes("academic.openu.ac.il");
  return new TextDecoder(utf8 ? "utf-8" : "windows-1255").decode(bytes);
}

function plain(html) {
  return html
    .replace(/<(br|\/p|\/li|\/div|\/h\d|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/[‎‏‪-‮﻿]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
}

export async function loadOpenUIndex(cacheDir) {
  const file = path.join(cacheDir, "openu-index.json");
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  const courses = new Map();
  for (let page = 1; page <= 40; page++) {
    const html = await fetchText(INDEX + page);
    if (!html) break;
    const found = [...html.matchAll(/mkurs=(\d{5})"[^>]*>\s*<span dir="rtl">([^<]+)<\/span>/g)];
    if (found.length === 0) break;
    for (const [, code, name] of found) courses.set(code, { code, name: name.trim() });
    await sleep(DELAY_MS);
  }
  const list = [...courses.values()];
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, JSON.stringify(list));
  console.error(`openu: ${list.length} courses in the catalog`);
  return list;
}

// The unit list follows "נושאי הלימוד" (or "פרקי הלימוד" / "פרקי הספר") with
// one unit per line, and ends at the footnotes / "חזרה" link.
export async function loadOpenUTopics(code, cacheDir) {
  const dir = path.join(cacheDir, "openu");
  const file = path.join(dir, `${code}.txt`);
  let text;
  if (existsSync(file)) {
    text = await readFile(file, "utf8");
  } else {
    const html = await fetchText(`${COURSE}${code}.htm`);
    await sleep(DELAY_MS);
    text = html ? plain(html) : "";
    await mkdir(dir, { recursive: true });
    await writeFile(file, text);
  }
  const start = text.match(/\n\s*(נושאי הלימוד|פרקי הלימוד|פרקי הספר|נושאי הקורס)\s*\n/);
  if (!start) return null;
  const lines = [];
  for (const line of text.slice(start.index + start[0].length).split("\n")) {
    const l = line.trim();
    if (!l) continue;
    if (/^\d$|^חזרה|^להשלכות|^הקורס נקרא|^עד סמסטר|^ראו|^הערה|^ספרי/.test(l)) break;
    if (/^חלק\s/.test(l)) continue; // "חלק ראשון: נושאים בסיסיים" groups units, it is not one
    lines.push(l.replace(/^\d{1,2}\s*[.)]\s*/, ""));
    if (lines.length >= 40) break;
  }
  // One unit per line → "; " keeps any commas inside a unit together.
  return lines.length >= 3 ? lines.join("; ") : null;
}
