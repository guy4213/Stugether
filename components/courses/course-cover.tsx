import {
  AtomIcon,
  BookOpenIcon,
  CodeIcon,
  DnaIcon,
  FlaskConicalIcon,
  LandmarkIcon,
  LanguagesIcon,
  PercentIcon,
  SigmaIcon,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { cn } from "cn";

// The mockups show a photo per course; we have no course imagery, so each
// course gets a deterministic gradient + a subject icon picked from its name.
const GRADIENTS = [
  "from-[oklch(0.45_0.17_262)] to-[oklch(0.62_0.14_230)]",
  "from-[oklch(0.42_0.16_290)] to-[oklch(0.6_0.15_265)]",
  "from-[oklch(0.45_0.11_200)] to-[oklch(0.65_0.12_175)]",
  "from-[oklch(0.38_0.12_250)] to-[oklch(0.55_0.16_245)]",
  "from-[oklch(0.45_0.14_310)] to-[oklch(0.62_0.14_280)]",
  "from-[oklch(0.42_0.1_220)] to-[oklch(0.6_0.13_195)]",
];

const ICON_RULES: { match: RegExp; icon: LucideIcon }[] = [
  { match: /מחשב|תכנות|אלגוריתם|נתונים|CS|computer/i, icon: CodeIcon },
  { match: /הסתברות|סטטיסטיקה|STAT/i, icon: PercentIcon },
  { match: /מתמטיקה|חשבון|אינפי|לינארית|MATH|calculus/i, icon: SigmaIcon },
  { match: /פיזיקה|PHYS/i, icon: AtomIcon },
  { match: /כימיה|CHEM/i, icon: FlaskConicalIcon },
  { match: /ביולוגיה|BIO/i, icon: DnaIcon },
  { match: /היסטוריה|HIST/i, icon: LandmarkIcon },
  { match: /אנגלית|שפ|ENG/i, icon: LanguagesIcon },
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function courseIcon(label: string): LucideIcon {
  return ICON_RULES.find((r) => r.match.test(label))?.icon ?? BookOpenIcon;
}

export function CourseCover({
  seed,
  label,
  className,
  iconClassName,
}: {
  seed: string;
  label: string;
  className?: string;
  iconClassName?: string;
}) {
  const icon = createElement(courseIcon(label), {
    className: cn("relative size-10 opacity-90", iconClassName),
    strokeWidth: 1.5,
  });
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-linear-to-br text-white",
        GRADIENTS[hash(seed) % GRADIENTS.length],
        className,
      )}
    >
      <div className="absolute -end-6 -top-6 size-24 rounded-full bg-white/10" />
      <div className="absolute -start-4 -bottom-8 size-20 rounded-full bg-white/10" />
      {icon}
    </div>
  );
}
