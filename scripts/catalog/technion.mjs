// scripts/catalog/technion.mjs
// Downloads the Technion course catalog (official course descriptions, which
// list each course's topics) from the open technion-sap-info-fetcher project:
// https://github.com/michael-maltsev/technion-sap-info-fetcher (data scraped
// from Technion's public SAP course pages, refreshed every semester).
//
// Used only as an equivalent-course source: a HIT course with no published
// topics borrows them from the same standard course at the Technion (see
// enrich.mjs). Exported: loadTechnion(cacheDir) → [{ code, name, faculty, syllabus }].

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const RAW = "https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages";
const SEMESTERS = 3; // newest first; a course keeps its newest description

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export async function loadTechnion(cacheDir) {
  const file = path.join(cacheDir, "technion.json");
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));

  const semesters = (await getJson(`${RAW}/last_semesters.json`)).slice(0, SEMESTERS);
  const byCode = new Map();
  for (const { year, semester } of semesters) {
    for (const { general: g } of await getJson(`${RAW}/courses_${year}_${semester}.json`)) {
      const code = g["מספר מקצוע"];
      const syllabus = (g["סילבוס"] ?? "").trim();
      if (byCode.has(code) || syllabus.length < 30) continue;
      // Responsible staff, exam dates and notes are dropped on purpose.
      byCode.set(code, { code, name: g["שם מקצוע"], faculty: g["פקולטה"], syllabus });
    }
  }
  const courses = [...byCode.values()];
  await writeFile(file, JSON.stringify(courses));
  console.error(`technion: ${courses.length} courses with a description`);
  return courses;
}
