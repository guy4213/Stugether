// scripts/catalog/external-degrees.mjs
// Interim catalog for degrees that HIT does not teach (mechanical engineering,
// physics, psychology, ...): the department gets the undergraduate courses of
// the matching faculty at the Technion, or of the matching discipline at the
// Open University, with their published topics.
//
//   node scripts/catalog/external-degrees.mjs YYYYMMDDNNNNNN_name.sql [--cache <dir>]
//
// Like templates.mjs this is a stand-in until the institution's own catalog
// is imported. Courses get no code; topics are 'equivalent_course' / 'draft'
// with a reference to the source course.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTechnion } from "./technion.mjs";
import { loadOpenUIndex } from "./openu.mjs";
import { splitTopics } from "./lib/topics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// [institution, department] ← { technion: faculty } | { openu: affiliation regex }.
export const DEGREES = [
  ["מכללת אפקה", "הנדסת מכונות", { technion: "הפקולטה להנדסת מכונות" }],
  ["אוניברסיטת בן־גוריון", "הנדסת מכונות", { technion: "הפקולטה להנדסת מכונות" }],
  ["האוניברסיטה העברית", "פיזיקה", { technion: "הפקולטה לפיזיקה" }],
  ["אוניברסיטת בן־גוריון", "פיזיקה", { technion: "הפקולטה לפיזיקה" }],
  ["אוניברסיטת בן־גוריון", "כימיה", { technion: "הפקולטה לכימיה" }],
  ["האוניברסיטה העברית", "מדעי החיים", { technion: "הפקולטה לביולוגיה" }],
  ["אוניברסיטת בן־גוריון", "מדעי החיים", { technion: "הפקולטה לביולוגיה" }],
  ["האוניברסיטה העברית", "רפואה", { technion: "הפקולטה לרפואה" }],
  ["אוניברסיטת בן־גוריון", "רפואה", { technion: "הפקולטה לרפואה" }],
  ["האוניברסיטה העברית", "חינוך", { technion: "חינוך למדע וטכנולוגיה" }],
  ["אוניברסיטת בן־גוריון", "חינוך", { technion: "חינוך למדע וטכנולוגיה" }],
  ["האוניברסיטה העברית", "מנהל עסקים", { technion: "הפקולטה למדעי הנתונים וההחלטות" }],
  ["אוניברסיטת בן־גוריון", "ניהול", { technion: "הפקולטה למדעי הנתונים וההחלטות" }],
  // Open University disciplines ("שיוך" line on each course page).
  ["האוניברסיטה העברית", "פסיכולוגיה", { openu: /פסיכולוגיה/ }],
  ["אוניברסיטת בן־גוריון", "פסיכולוגיה", { openu: /פסיכולוגיה/ }],
  ["האוניברסיטה העברית", "כלכלה", { openu: /כלכלה/ }],
  ["אוניברסיטת בן־גוריון", "כלכלה", { openu: /כלכלה/ }],
  ["האוניברסיטה העברית", "היסטוריה", { openu: /היסטוריה/ }],
  ["אוניברסיטת בן־גוריון", "מדע המדינה וממשל", { openu: /מדע המדינה/ }],
  ["אוניברסיטת בן־גוריון", "סוציולוגיה ואנתרופולוגיה", { openu: /סוציולוגיה|אנתרופולוגיה/ }],
  ["האוניברסיטה העברית", "משפטים", { openu: /משפט/ }],
  ["אוניברסיטת בן־גוריון", "סיעוד", { openu: /סיעוד|מדעי הבריאות/ }],
];

const MAX_COURSES = 80; // per department, keeps the course list browsable

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);
const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

// Open University pages (cached by openu.mjs): affiliation + unit list.
async function openuCourses(cacheDir) {
  const index = await loadOpenUIndex(cacheDir);
  const out = [];
  for (const { code, name } of index) {
    const file = path.join(cacheDir, "openu", `${code}.txt`);
    if (!existsSync(file)) continue;
    const text = await readFile(file, "utf8");
    const affiliation = text.match(/שיוך:\s*([^\n]+)/)?.[1]?.trim() ?? "";
    const level = text.match(/נקודות זכות ברמה ([^\s]+)/)?.[1] ?? "";
    const credits = Number.parseFloat(text.match(/(\d+(?:\.\d+)?)\s*נקודות זכות/)?.[1]) || null;
    const start = text.match(/\n\s*(נושאי הלימוד|פרקי הלימוד|פרקי הספר|נושאי הקורס)\s*\n/);
    let topics = [];
    if (start) {
      const lines = [];
      for (const line of text.slice(start.index + start[0].length).split("\n")) {
        const l = line.trim();
        if (!l) continue;
        if (/^\d$|^חזרה|^להשלכות|^הקורס נקרא|^עד סמסטר|^ראו|^הערה|^ספרי/.test(l)) break;
        if (/^חלק\s/.test(l)) continue;
        lines.push(l.replace(/^\d{1,2}\s*[.)]\s*/, ""));
      }
      topics = splitTopics(lines.join("; "));
    }
    out.push({ code, name, affiliation, level, credits, topics });
  }
  return out;
}

function pickTechnion(technion, faculty) {
  return technion
    .filter((t) => t.faculty === faculty && t.framework === "לימודי הסמכה")
    .map((t) => ({
      name: t.name,
      credits: t.credits,
      topics: splitTopics(t.syllabus.replaceAll("!", ",")),
      ref: `Technion ${t.code} ${t.name}`,
      url: `https://students.technion.ac.il/local/technionsearch/course/${t.code}`,
    }))
    .filter((c) => c.topics.length >= 3)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

function pickOpenU(openu, affiliation) {
  return (
    openu
      .filter(
        (c) =>
          affiliation.test(c.affiliation) &&
          !/תואר שני/.test(c.affiliation) &&
          c.topics.length >= 3,
      )
      // Introductory and regular levels first: the core of a bachelor's degree.
      .sort((a, b) => levelRank(a.level) - levelRank(b.level) || a.name.localeCompare(b.name, "he"))
      .map((c) => ({
        name: c.name,
        credits: c.credits,
        topics: c.topics,
        ref: `האוניברסיטה הפתוחה ${c.code} ${c.name}`,
        url: `https://www.openu.ac.il/courses/${c.code}.htm`,
      }))
  );
}

function levelRank(level) {
  return { פתיחה: 0, רגילה: 1, מתקדמת: 2 }[level] ?? 3;
}

async function main() {
  const name = process.argv[2];
  if (!name || !/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) {
    throw new Error("usage: node scripts/catalog/external-degrees.mjs YYYYMMDDNNNNNN_name.sql");
  }
  const cacheIdx = process.argv.indexOf("--cache");
  const cacheDir = path.resolve(
    cacheIdx > 0 ? process.argv[cacheIdx + 1] : path.join(ROOT, "supabase/catalog/.cache"),
  );
  await mkdir(cacheDir, { recursive: true });

  const technion = await loadTechnion(cacheDir);
  const openu = await openuCourses(cacheDir);

  const courseRows = [];
  const topicRows = [];
  const subRows = [];
  for (const [institution, department, src] of DEGREES) {
    const courses = (
      src.technion ? pickTechnion(technion, src.technion) : pickOpenU(openu, src.openu)
    )
      .filter((c, i, all) => all.findIndex((x) => x.name === c.name) === i)
      .slice(0, MAX_COURSES);
    console.error(`${institution} / ${department}: ${courses.length} courses`);
    for (const c of courses) {
      const key = `${q(institution)}, ${q(department)}, ${q(clip(c.name, 200))}`;
      courseRows.push(`  (${key}, ${c.credits ?? "NULL"})`);
      c.topics.forEach((t, i) => {
        topicRows.push(
          `  (${key}, ${i + 1}, ${q(clip(t.title, 120))}, ${q(clip(c.ref, 200))}, ${q(c.url)})`,
        );
        t.subtopics.forEach((s, j) =>
          subRows.push(`  (${key}, ${i + 1}, ${j + 1}, ${q(clip(s, 120))})`),
        );
      });
    }
  }

  const sql = `-- =============================================================================
-- ${name}
-- GENERATED by scripts/catalog/external-degrees.mjs. Interim catalog for
-- degrees H.IT does not teach: undergraduate courses of the matching Technion
-- faculty or Open University discipline, with their published topics
-- ('equivalent_course' / 'draft', source_ref names the source course).
-- =============================================================================

CREATE TEMP TABLE _ext_courses (institution text, department text, name text, credits numeric);
INSERT INTO _ext_courses VALUES
${courseRows.join(",\n")};

CREATE TEMP TABLE _ext_topics (institution text, department text, name text, position smallint, title text, source_ref text, source_url text);
INSERT INTO _ext_topics VALUES
${topicRows.join(",\n")};

CREATE TEMP TABLE _ext_subtopics (institution text, department text, name text, parent_position smallint, position smallint, title text);
${subRows.length > 0 ? `INSERT INTO _ext_subtopics VALUES\n${subRows.join(",\n")};` : "-- (no subtopics)"}

CREATE TEMP TABLE _ext_dept AS
SELECT DISTINCT e.institution, e.department, d.id AS department_id, d.institution_id
  FROM _ext_courses e
  JOIN public.institutions i ON i.name = e.institution
  JOIN public.departments d ON d.institution_id = i.id AND d.name = e.department;

-- 1. The starter courses of these departments are replaced.
UPDATE public.courses c
   SET is_active = false
 WHERE c.code IS NULL
   AND c.department_id IN (SELECT department_id FROM _ext_dept)
   AND NOT EXISTS (SELECT 1 FROM public.course_topics ct WHERE ct.course_id = c.id);

-- 2. Courses.
INSERT INTO public.courses (institution_id, department_id, code, name, credits, is_active)
SELECT d.institution_id, d.department_id, NULL, e.name, e.credits, true
  FROM _ext_courses e
  JOIN _ext_dept d ON d.institution = e.institution AND d.department = e.department
 WHERE NOT EXISTS (
         SELECT 1 FROM public.courses c
          WHERE c.department_id = d.department_id AND c.name = e.name AND c.is_active);

CREATE TEMP TABLE _ext_map AS
SELECT DISTINCT ON (c.id) c.id AS course_id, d.institution, d.department, c.name
  FROM _ext_dept d
  JOIN public.courses c ON c.department_id = d.department_id AND c.code IS NULL AND c.is_active
 WHERE NOT EXISTS (SELECT 1 FROM public.course_topics ct WHERE ct.course_id = c.id);

-- 3. Topics + subtopics.
INSERT INTO public.course_topics (course_id, position, title, source, status, source_ref, source_url)
SELECT m.course_id, t.position, t.title, 'equivalent_course', 'draft', t.source_ref, t.source_url
  FROM _ext_topics t
  JOIN _ext_map m ON m.institution = t.institution AND m.department = t.department AND m.name = t.name;

INSERT INTO public.course_topics (course_id, parent_id, position, title, source, status, source_ref, source_url)
SELECT m.course_id, p.id, s.position, s.title, 'equivalent_course', 'draft', p.source_ref, p.source_url
  FROM _ext_subtopics s
  JOIN _ext_map m ON m.institution = s.institution AND m.department = s.department AND m.name = s.name
  JOIN public.course_topics p ON p.course_id = m.course_id AND p.parent_id IS NULL AND p.position = s.parent_position;

DROP TABLE _ext_courses, _ext_topics, _ext_subtopics, _ext_dept, _ext_map;
`;
  const out = path.join(ROOT, "supabase/migrations", name);
  await writeFile(out, sql);
  console.error(
    `→ ${path.relative(ROOT, out)}: ${courseRows.length} courses, ${topicRows.length} topics`,
  );
}

await main();
