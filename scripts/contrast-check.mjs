// Standalone OKLCH -> sRGB -> WCAG contrast ratio checker, no deps.
// Implements the OKLab/OKLCH <-> linear-sRGB math from Björn Ottosson's
// reference (https://bottosson.github.io/posts/oklab/) and the standard
// WCAG 2 relative-luminance / contrast-ratio formulas.
//
// Run with `node scripts/contrast-check.mjs` and keep the L/C/H values below
// in sync with app/globals.css whenever the theme tokens change.

function oklchToOklab([L, C, H]) {
  const hRad = (H * Math.PI) / 180;
  return [L, C * Math.cos(hRad), C * Math.sin(hRad)];
}

function oklabToLinearSrgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToSrgb(c) {
  const cc = Math.min(1, Math.max(0, c));
  return cc <= 0.0031308 ? 12.92 * cc : 1.055 * cc ** (1 / 2.4) - 0.055;
}

function oklch(L, C, H) {
  const lab = oklchToOklab([L, C, H]);
  const [r, g, b] = oklabToLinearSrgb(lab);
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

function relLuminance([r, g, b]) {
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(rgb1, rgb2) {
  const L1 = relLuminance(rgb1);
  const L2 = relLuminance(rgb2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function check(name, fg, bg, target = 4.5) {
  const ratio = contrastRatio(oklch(...fg), oklch(...bg));
  const pass = ratio >= target ? "PASS" : "FAIL";
  console.log(`${pass}  ${name}: ${ratio.toFixed(2)}:1 (target ${target}:1)`);
}

console.log("--- LIGHT THEME ---");
check("foreground on background", [0.22, 0.045, 258], [0.99, 0.004, 240]);
check("primary-foreground on primary", [0.99, 0.005, 240], [0.54, 0.16, 246]);
check("secondary-foreground on secondary", [0.18, 0.04, 200], [0.72, 0.14, 168]);
check("muted-foreground on background", [0.48, 0.03, 250], [0.99, 0.004, 240]);
check("accent-foreground on accent", [0.25, 0.05, 258], [0.93, 0.04, 246]);
check("foreground on card", [0.22, 0.045, 258], [0.965, 0.014, 246]);

console.log("\n--- DARK THEME ---");
check("foreground on background", [0.97, 0.01, 240], [0.18, 0.045, 258]);
check("primary-foreground on primary", [0.15, 0.04, 258], [0.72, 0.15, 235]);
check("secondary-foreground on secondary", [0.15, 0.04, 200], [0.75, 0.16, 165]);
check("muted-foreground on background", [0.68, 0.02, 245], [0.18, 0.045, 258]);
check("accent-foreground on accent", [0.95, 0.01, 240], [0.3, 0.06, 250]);
check("foreground on card", [0.97, 0.01, 240], [0.24, 0.05, 258]);

console.log("\n--- HERO (hardcoded gradient, always-dark) ---");
check("white text on hero gradient start", [1, 0, 0], [0.18, 0.045, 258]);
check("white text on hero gradient end", [1, 0, 0], [0.28, 0.09, 235]);
