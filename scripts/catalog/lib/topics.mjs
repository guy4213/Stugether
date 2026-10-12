// scripts/catalog/lib/topics.mjs
// Deterministic splitter: an official "topics" paragraph → [{ title, subtopics }].
// No model involved — the output only ever contains phrases from the source.
//
//   splitTopics("1. אותות רציפים ובדידים 2. מערכות ... 4. התמרת לפלס")
//   splitTopics("מבנה האטום: מספר אטומי, מסה אטומית; חישובים מולאריים: מול, ...")
//   splitTopics("שדות, מספרים מרוכבים. מערכות משוואות לינאריות ומטריצות, ...")
//
// Subtopics come only from an explicit "heading: a, b, c" shape; everything
// else is a flat list of topics in source order.

const MAX_TOPICS = 40;
const MAX_TITLE = 120;
const PLACEHOLDER = "\u0001";

// Sentences that describe the course instead of naming a topic.
const PROSE =
  /(^|\s)(הקורס|בקורס|זהו|יושם|ילמדו|יילמדו|נלמד|נלמדים|יוקנו|הסטודנט|הסטודנטים|במהלך|נעסוק|יעסוק|נדון|יידונו|הנידונים|המקנה|תינתנה|ניתן דגש|יינתן)(\s|$)/;

// Openers before the actual list: "הנושאים העיקריים הם:", "נושאי הלימוד:", "כגון:".
const LEAD_IN =
  /(נושאי (ה)?לימוד|נושאי הקורס|הנושאים (העיקריים|שיילמדו|הנלמדים)[^:]{0,30}|כגון|ביניהם|בין היתר)\s*:/g;

function clean(item) {
  return item
    .replaceAll(PLACEHOLDER, ",")
    .replace(/^[\s\-–•·*.,;:]+|[\s.,;:\-–]+$/g, "")
    .replace(/^\d{1,2}\s*[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function keep(title) {
  return title.length >= 2 && title.length <= MAX_TITLE && !PROSE.test(title);
}

// Commas inside parentheses belong to one topic: "התפלגויות (בינומית, פואסונית)".
function protectParens(text) {
  let depth = 0;
  let out = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    out += ch === "," && depth > 0 ? PLACEHOLDER : ch;
  }
  // An unclosed "(" would swallow every following comma: leave text as is.
  return depth === 0 ? out : text;
}

function toTopic(item) {
  const colon = item.indexOf(":");
  if (colon > 1 && colon <= 40) {
    const title = clean(item.slice(0, colon));
    const subtopics = item
      .slice(colon + 1)
      .split(/[,،]/)
      .map(clean)
      .filter(keep);
    if (keep(title) && subtopics.length > 0) return { title, subtopics };
  }
  const title = clean(item);
  return keep(title) ? { title, subtopics: [] } : null;
}

export function splitTopics(raw) {
  if (!raw) return [];
  let text = raw
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const leadIns = [...text.matchAll(LEAD_IN)];
  if (leadIns.length > 0) {
    const last = leadIns.at(-1);
    text = text.slice(last.index + last[0].length);
  }
  text = protectParens(text);

  let items;
  const numbered = text.split(/(?:^|\s)\d{1,2}\s*[.)]\s+/).filter((s) => s.trim());
  if (numbered.length >= 3) {
    items = numbered;
  } else if ((text.match(/;/g) ?? []).length >= 2) {
    items = text.split(";");
  } else {
    // Plain paragraph: sentences, then comma-separated items within each.
    items = text.split(/\.\s+|\.$/).flatMap((sentence) =>
      // Keep "heading: a, b" sentences whole so toTopic can nest them.
      /^[^,]{2,40}:/.test(sentence.trim()) ? [sentence] : sentence.split(/[,،]/),
    );
  }

  // "... פונקצית הסתברות. קומבינטוריקה: חליפות, ..." — a new "heading:" starts a new item.
  items = items.flatMap((item) => item.split(/\.\s+(?=[^.,;:]{2,40}:)/));

  const seen = new Set();
  const topics = [];
  for (const item of items) {
    const topic = toTopic(item);
    if (!topic || seen.has(topic.title)) continue;
    seen.add(topic.title);
    topics.push(topic);
    if (topics.length === MAX_TOPICS) break;
  }
  return topics;
}
