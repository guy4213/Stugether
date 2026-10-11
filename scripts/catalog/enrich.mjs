// scripts/catalog/enrich.mjs
// Merges the topic sources into supabase/catalog/hit-courses.json — the file
// the catalog migration is generated from.
//
//   node scripts/catalog/enrich.mjs [--cache <dir>]
//
// Per HIT course, the first source that has topics wins:
//   1. hit_current  — the current HIT handbook's course summary (hit.json)
//   2. hit_archive  — HIT's own archived syllabus, matched by course code
//                     and confirmed by name (hit-archive.json)
//   2b. hit_archive_name — HIT's own older syllabus matched by name (the
//                     code changed, e.g. design was renumbered in 2013-14)
//   3. technion     — the same standard course at the Technion, matched by
//                     normalized name (technion.mjs)
//   4. braude       — the same at Braude College (braude.mjs)
//   5. openu        — the same at the Open University (openu.mjs)
// Courses with no match keep an empty topic list. Nothing is generated.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTechnion } from "./technion.mjs";
import { loadOpenUIndex, loadOpenUTopics } from "./openu.mjs";
import { loadBraudeIndex, loadBraudeTopics } from "./braude.mjs";
import { splitTopics } from "./lib/topics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG = path.join(ROOT, "supabase/catalog");
const OUT = path.join(CATALOG, "hit-courses.json");

// Technion faculties to prefer when several courses share a name.
const FACULTY_PREFERENCE = {
  "מדעי המחשב": ["הפקולטה למדעי המחשב", "הפקולטה למתמטיקה", "הפקולטה לפיזיקה"],
  "מתמטיקה שימושית": ["הפקולטה למתמטיקה", "מתמטיקה שימושית", "הפקולטה למדעי המחשב"],
  "הנדסת חשמל ואלקטרוניקה": ["הפקולטה להנדסת חשמל ומחשבים", "הפקולטה למתמטיקה", "הפקולטה לפיזיקה"],
  "הנדסת תעשייה וניהול טכנולוגיה": ["הפקולטה למדעי הנתונים וההחלטות", "הפקולטה למתמטיקה"],
  "טכנולוגיות רפואיות דיגיטליות": [
    "הפקולטה להנדסה ביו-רפואית",
    "הפקולטה לרפואה",
    "הפקולטה לביולוגיה",
  ],
  "עיצוב פנים": ["הפקולטה לארכיטקטורה ובינוי ערים"],
  "עיצוב תעשייתי": ["הפקולטה לארכיטקטורה ובינוי ערים"],
  "עיצוב תקשורת חזותית": ["הפקולטה לארכיטקטורה ובינוי ערים"],
};

// Course kinds whose content is the student's own work — another
// institution's "project" says nothing about this one.
// Anchored to the start: "פרויקט גמר" is a project, "ניהול פרויקטים" is not.
const NO_EQUIVALENT =
  /^(קדם[ -])?(פרוי?יקט|סמינר|סטודיו|תזה|עבודת גמר|סיור)|רב[ -]?תחומי|קורס בחירה|התמחות/;

// ---------------------------------------------------------------------------
// Name normalization for matching
// ---------------------------------------------------------------------------
const SYNONYMS = new Map([
  ["אינפי", "אינפיניטסימלי"],
  ["ליניארית", "לינארית"],
  ["ליניארי", "לינארי"],
  ["פיזיקה", "פיסיקה"],
  ["מורכבות", "מרוכבות"],
  ["דיסקרטית", "בדידה"],
  ["סדנא", "סדנה"],
  ["תיכנות", "תכנות"],
  ["אינטגראליות", "אינטגרליות"],
  ["פונקצית", "פונקציות"],
]);
const HEB_NUM = { א: "1", ב: "2", ג: "3", ד: "4", ה: "5" };
// Audience suffixes ("... למהנדסים", "... לניהול טכנולוגיה") and Technion
// variant markers ("מ'", "ח'", "1מ1", "/מורחב").
const AUDIENCE =
  /\s+ל(מהנדסים|מהנדסי [^\s]+|ניהול טכנולוגיה|נה"?ט|מתמטיקה שימושית|רפואה דיגיטלית|מדעי המחשב|מדמ"?ח|תעשייה וניהול)$/;

// Words that say nothing about the subject; a match must share something else.
const GENERIC = new Set(["מבוא", "יסוד", "עקרונ", "נושא", "נבחר", "פרק", "מתקדמ", "תורת", "שיט"]);
// Hands-on course kinds: only match the same kind.
const PRACTICAL = /^(מעבד|סדנ|פרוי?יקט|סמינר)/;

function audienceOf(name) {
  return name.trim().match(AUDIENCE)?.[1] ?? "";
}

function tokens(name) {
  const base = name
    .replace(/[״"]/g, '"')
    .replace(/חדו"א/g, "חשבון אינפיניטסימלי")
    .replace(/\/\s*מורחב/g, " ")
    .replace(/(\d)\s*[א-ת]['׳]?(\d)?(?=\s|$)/g, "$1") // "1מ'", "2מ", "1מ1"
    .replace(/\s+[מחתנר]['׳]?\s*$/, "") // trailing "מ'" / "ח'"
    .trim();
  // Drop a trailing audience ("... למהנדסים") unless it IS the subject:
  // "מבוא למדעי המחשב" must not shrink to "מבוא".
  const withoutAudience = words(base.replace(AUDIENCE, ""));
  return withoutAudience.some((t) => !GENERIC.has(t) && !/^\d+$/.test(t))
    ? withoutAudience
    : words(base);
}

function words(s) {
  return s
    .replace(/[()[\],.:;–\-/\\+]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/['׳"]$/, ""))
    .filter(Boolean)
    .map((t) => {
      if (/^[א-ה]$/.test(t)) return HEB_NUM[t]; // "א'" → "1"
      if (/^[מחתנרו]$/.test(t)) return null; // lone variant marker / conjunction
      return stem(SYNONYMS.get(t) ?? t);
    })
    .filter(Boolean);
}

// Crude Hebrew stem, applied to both sides alike: drop one prefix letter
// (ו/ה/ב/ל/מ/ש/כ) and a plural/construct ending on longer words, so
// "למערכות"≈"מערכת", "תמונות"≈"תמונה", "ותכן"≈"תכן", "באוטומטים"≈"אוטומטיים".
function stem(word) {
  if (/^[A-Za-z0-9]+$/.test(word)) return word.toLowerCase();
  let w = word;
  if (w.length > 4 && /^[והבלמשכ]/.test(w)) w = w.slice(1);
  if (w.length > 4) w = w.replace(/(יים|ים|ות|יות|ית|ה|ת)$/, "");
  return w;
}

// Names are short, so score both overlap (Jaccard) and containment
// ("מבוא לכלכלה" inside "מבוא לכלכלה מיקרו ומאקרו", "סימולציה" inside
// "סימולציה-מידול, ניתוח ויישומים"), the latter a bit lower.
function similarity(a, b) {
  const numsA = a.filter((t) => /^\d+$/.test(t)).join(",");
  const numsB = b.filter((t) => /^\d+$/.test(t)).join(",");
  // "פיסיקה 1" never matches "פיסיקה 2", but an unnumbered course is part 1:
  // "מבני נתונים" ≈ "מבני נתונים 1".
  const sameNumbers = numsA === numsB || (!numsA && numsB === "1") || (numsA === "1" && !numsB);
  if (!sameNumbers) return 0;
  const wa = new Set(a.filter((t) => !/^\d+$/.test(t)));
  const wb = new Set(b.filter((t) => !/^\d+$/.test(t)));
  if (wa.size === 0 || wb.size === 0) return 0;
  const sharedWords = [...wa].filter((t) => wb.has(t));
  if (!sharedWords.some((t) => !GENERIC.has(t))) return 0;
  const shared = sharedWords.length;
  const jaccard = shared / (wa.size + wb.size - shared);
  // a = the HIT name, b = the candidate. The HIT name may sit inside a longer
  // candidate ("מבני נתונים" ⊂ "מבני נתונים 1", "סימולציה" ⊂ "סימולציה-מידול,
  // ניתוח ויישומים"), never the reverse: a short candidate ("עיצוב",
  // "אלגוריתמים 1") inside a specific HIT name is a different course.
  // One-word HIT names ("גרפיקה", "פרסום") are too vague to extend, and each
  // extra candidate word costs confidence: at most one extra word passes.
  let containment = 0;
  if (shared === wa.size && wa.size >= 2) containment = 0.85 - 0.05 * (wb.size - wa.size);
  return Math.max(jaccard, containment);
}

const MIN_EQUIVALENT = 0.8;
const MIN_SAME_CODE = 0.34; // same code at HIT: just confirm it is still the same course

// Best-named candidate ({ name, tokens, faculty? }) for a HIT course, or null.
function bestEquivalent(course, department, candidates) {
  if (NO_EQUIVALENT.test(course.name)) return null;
  const mine = tokens(course.name);
  const practical = PRACTICAL.test(course.name);
  const prefs = FACULTY_PREFERENCE[department] ?? [];
  let best = null;
  for (const t of candidates) {
    if (PRACTICAL.test(t.name) !== practical || NO_EQUIVALENT.test(t.name)) continue;
    const score = similarity(mine, t.tokens);
    if (score < MIN_EQUIVALENT) continue;
    const pref = prefs.indexOf(t.faculty);
    // Closest name first (fewest extra words), then the expected faculty.
    const extra = Math.abs(t.tokens.length - mine.length);
    const rank = [score, -extra, pref < 0 ? -99 : -pref, t.syllabus?.length ?? 0];
    if (!best || compare(rank, best.rank) > 0) best = { t, rank };
  }
  return best?.t ?? null;
}

function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

// ---------------------------------------------------------------------------
async function main() {
  const cacheIdx = process.argv.indexOf("--cache");
  const cacheDir = path.resolve(
    cacheIdx > 0 ? process.argv[cacheIdx + 1] : path.join(CATALOG, ".cache"),
  );
  await mkdir(cacheDir, { recursive: true });

  const hit = JSON.parse(await readFile(path.join(CATALOG, "hit.json"), "utf8"));
  const archiveFile = JSON.parse(await readFile(path.join(CATALOG, "hit-archive.json"), "utf8"));
  const archive = archiveFile.courses;
  // HIT's own older syllabi, for name matching when the code has changed
  // (design was renumbered in 2013-14).
  const archiveByName = [...Object.values(archive), ...(archiveFile.by_name ?? [])]
    .filter((a) => a.topics.length >= 3)
    .map((a) => ({ ...a, tokens: tokens(a.name) }));
  // Only candidates whose description actually splits into topics compete;
  // some SAP texts have "!" where the commas were.
  const technion = (await loadTechnion(cacheDir))
    .map((t) => ({ ...t, syllabus: t.syllabus.replaceAll("!", ",") }))
    .filter((t) => splitTopics(t.syllabus).length >= 3)
    .map((t) => ({ ...t, tokens: tokens(t.name) }));
  const openu = (await loadOpenUIndex(cacheDir)).map((t) => ({ ...t, tokens: tokens(t.name) }));
  const braude = (await loadBraudeIndex(cacheDir)).map((t) => ({ ...t, tokens: tokens(t.name) }));

  const stats = {};
  for (const dept of hit.departments) {
    const s = (stats[dept.name] = {
      courses: 0,
      hit_current: 0,
      hit_archive: 0,
      hit_archive_name: 0,
      technion: 0,
      braude: 0,
      openu: 0,
      none: 0,
    });
    for (const course of dept.courses) {
      s.courses++;
      const archived = archive[course.code];
      const sameCourse =
        archived && similarity(tokens(course.name), tokens(archived.name)) >= MIN_SAME_CODE;
      // Descriptions come from the current handbook only: in the archived PDFs
      // the goal paragraph can run into a neighbouring column.

      if (course.topics.length > 0) {
        course.topics_source = {
          kind: "hit_current",
          url: course.source_url,
          ref: course.academic_year,
        };
        s.hit_current++;
        continue;
      }
      if (sameCourse && archived.topics.length > 0) {
        course.topics = archived.topics;
        course.topics_source = {
          kind: "hit_archive",
          url: archived.source_url,
          ref: `${archived.code} ${archived.name} (${archived.academic_year})`,
        };
        s.hit_archive++;
        continue;
      }
      // Within HIT the audience is part of the course: "חשבון אינפי 1 לניהול
      // טכנולוגיה" is not the applied-math calculus.
      const renamed = bestEquivalent(
        course,
        dept.name,
        archiveByName.filter((a) => audienceOf(a.name) === audienceOf(course.name)),
      );
      if (renamed) {
        course.topics = renamed.topics;
        course.topics_source = {
          kind: "hit_archive_name",
          url: renamed.source_url,
          ref: `${renamed.code ? `${renamed.code} ` : ""}${renamed.name} (${renamed.academic_year})`,
        };
        s.hit_archive_name++;
        continue;
      }
      const eq = bestEquivalent(course, dept.name, technion);
      const eqTopics = eq ? splitTopics(eq.syllabus) : [];
      if (eqTopics.length >= 3) {
        course.topics = eqTopics;
        course.topics_source = {
          kind: "technion",
          url: `https://students.technion.ac.il/local/technionsearch/course/${eq.code}`,
          ref: `${eq.code} ${eq.name}`,
        };
        s.technion++;
        continue;
      }
      const br = bestEquivalent(course, dept.name, braude);
      const brTopics = splitTopics(br ? await loadBraudeTopics(br.code, cacheDir) : null);
      if (brTopics.length >= 3) {
        course.topics = brTopics;
        course.topics_source = {
          kind: "braude",
          url: `https://info.braude.ac.il/yedion/fireflyweb.aspx?prgname=S_LOOK_FOR_NOSE&arguments=-N${br.code}`,
          ref: `${br.code} ${br.name}`,
        };
        s.braude++;
        continue;
      }
      const ou = bestEquivalent(course, dept.name, openu);
      const ouText = ou ? await loadOpenUTopics(ou.code, cacheDir) : null;
      const ouTopics = splitTopics(ouText);
      if (ouTopics.length >= 3) {
        course.topics = ouTopics;
        course.topics_source = {
          kind: "openu",
          url: `https://www.openu.ac.il/courses/${ou.code}.htm`,
          ref: `${ou.code} ${ou.name}`,
        };
        s.openu++;
        continue;
      }
      course.topics_source = null;
      s.none++;
    }
  }

  await writeFile(
    OUT,
    JSON.stringify({ ...hit, enriched_at: new Date().toISOString().slice(0, 10) }, null, 2) + "\n",
  );
  console.table(stats);
  console.error(`→ ${path.relative(ROOT, OUT)}`);
}

if (process.argv[1]?.endsWith("enrich.mjs")) await main();
export { tokens, similarity };
