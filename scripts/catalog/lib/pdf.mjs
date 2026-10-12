// scripts/catalog/lib/pdf.mjs
// Text from Hebrew syllabus PDFs (Word exports), via poppler's pdftotext.

import { execFileSync } from "node:child_process";

export function pdfText(file) {
  return normalize(
    execFileSync("pdftotext", ["-enc", "UTF-8", file, "-"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
}

// pdftotext keeps Hebrew in logical order but misplaces neutral characters
// around direction changes: " ,מילה" → ", מילה", " .1מבוא" → " 1. מבוא".
export function normalize(raw) {
  return (
    raw
      .replace(/[‎‏‪-‮]/g, "")
      .replace(/\r/g, "")
      .replace(/\f/g, "\n")
      .replace(/(^|\s)\.(\d{1,2})(?=[^\d\s.])/gm, "$1$2. ")
      .replace(/\s+([,;:])(?=[^\s\d])/g, "$1 ")
      .replace(/\s\.(?=[֐-׿])/g, ". ")
      // Mirrored parentheses: ")זמן ומקום(" → "(זמן ומקום)".
      .replace(/\)([^()\n]{1,80})\(/g, "($1)")
      // Latin runs come out glued to the Hebrew around them: "BJTוטרנזיסטור", "ממשפחת .ECL".
      .replace(/([A-Za-z0-9])(?=[א-ת])/g, "$1 ")
      .replace(/([א-ת])(?=[A-Za-z])/g, "$1 ")
      .replace(/\s\.([A-Za-z][\w-]*)/g, " $1.")
      .replace(/[ \t]+/g, " ")
  );
}
