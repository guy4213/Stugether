// Generates the illustrated avatars of demo mode (lib/demo) into
// public/demo/avatars. Static SVGs, no external service: run once with
// `node scripts/generate-demo-avatars.mjs` after changing the list below.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "..", "public", "demo", "avatars");

// [file, background, skin, hair color, hair style, shirt]
const AVATARS = [
  ["me", "#DDEBFF", "#F2C9A5", "#5B3A29", "long", "#2563EB"],
  ["p1", "#D8F3EA", "#E8B48F", "#2B2118", "short", "#0D9488"],
  ["p2", "#FDE2E7", "#F5D0B0", "#8B4A2B", "bun", "#E11D48"],
  ["p3", "#FEF3C7", "#C98B62", "#1F1A17", "buzz", "#D97706"],
  ["p4", "#EDE9FE", "#F2C9A5", "#C2884F", "long", "#7C3AED"],
  ["p5", "#E0F2FE", "#D9A27E", "#3B2A20", "short", "#0284C7"],
  ["p6", "#FCE7F3", "#E8B48F", "#1F1A17", "curly", "#DB2777"],
  ["p7", "#DCFCE7", "#F5D0B0", "#A0522D", "short", "#16A34A"],
  ["p8", "#E0E7FF", "#B9805A", "#1F1A17", "curly", "#4F46E5"],
  ["p9", "#FFEDD5", "#E8B48F", "#4A3426", "buzz", "#EA580C"],
  ["p10", "#F3E8FF", "#F2C9A5", "#E0B36A", "long", "#9333EA"],
  ["p11", "#CCFBF1", "#D9A27E", "#2B2118", "short", "#0F766E"],
  ["p12", "#FFE4E6", "#C98B62", "#2B2118", "bun", "#BE123C"],
  ["p13", "#E2E8F0", "#F5D0B0", "#6B4423", "short", "#334155"],
  ["p14", "#DBEAFE", "#E8B48F", "#1F1A17", "curly", "#1D4ED8"],
];

function hair(style, color) {
  switch (style) {
    case "long":
      return `<path d="M30 52c0-17 9-27 22-27s22 10 22 27v34H62V58H42v28H30z" fill="${color}"/>
  <path d="M33 50c3-12 10-17 19-17s16 5 19 17c-9-2-17-7-21-12-3 6-9 10-17 12z" fill="${color}"/>`;
    case "bun":
      return `<circle cx="52" cy="22" r="9" fill="${color}"/>
  <path d="M32 50c1-14 9-21 20-21s19 7 20 21c-6-6-13-9-20-9s-14 3-20 9z" fill="${color}"/>`;
    case "curly":
      return `<g fill="${color}">${[34, 41, 48, 56, 63, 70]
        .map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 31 : 35}" r="8"/>`)
        .join("")}<circle cx="33" cy="44" r="6"/><circle cx="71" cy="44" r="6"/></g>`;
    case "buzz":
      return `<path d="M33 47c0-12 8-19 19-19s19 7 19 19c-5-4-12-6-19-6s-14 2-19 6z" fill="${color}" opacity=".85"/>`;
    default:
      return `<path d="M32 48c0-14 9-21 20-21s20 7 20 21c-4-3-8-5-12-5l-3-6-4 6H44l-3-5-3 6c-2 1-4 2-6 4z" fill="${color}"/>`;
  }
}

function svg([, bg, skin, hairColor, style, shirt]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104">
  <rect width="104" height="104" fill="${bg}"/>
  <path d="M18 104c2-19 16-29 34-29s32 10 34 29z" fill="${shirt}"/>
  <rect x="45" y="62" width="14" height="16" rx="6" fill="${skin}"/>
  <ellipse cx="52" cy="50" rx="18" ry="20" fill="${skin}"/>
  ${hair(style, hairColor)}
  <circle cx="45" cy="52" r="2" fill="#1F2937"/>
  <circle cx="59" cy="52" r="2" fill="#1F2937"/>
  <path d="M46 60c3 3 9 3 12 0" stroke="#1F2937" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>
`;
}

mkdirSync(OUT, { recursive: true });
for (const avatar of AVATARS) writeFileSync(join(OUT, `${avatar[0]}.svg`), svg(avatar));
console.log(`wrote ${AVATARS.length} avatars to ${OUT}`);
