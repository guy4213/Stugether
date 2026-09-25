import {
  AtomIcon,
  BookOpenIcon,
  ChartColumnIcon,
  CodeXmlIcon,
  CpuIcon,
  DnaIcon,
  FlaskConicalIcon,
  Grid3x3Icon,
  LandmarkIcon,
  LanguagesIcon,
  NetworkIcon,
  PercentIcon,
  SigmaIcon,
  SquareTerminalIcon,
  type LucideIcon,
} from "lucide-react";
import { hashString, type Tone } from "@/lib/ui/tones";

export type CourseTheme = {
  icon: LucideIcon;
  // Soft icon tile / progress tone on white cards.
  tone: Tone;
  // Cover / banner gradient (120deg start → end).
  gradient: [string, string];
};

// Order matters: the most specific subject first (e.g. "מבוא למדעי המחשב"
// before the generic computer-science rule). Colors follow the mockup.
const RULES: { match: RegExp; theme: CourseTheme }[] = [
  {
    match: /מבני נתונים|data struct/i,
    theme: { icon: CodeXmlIcon, tone: "blue", gradient: ["#1e3a8a", "#2563eb"] },
  },
  {
    match: /אלגוריתם|algorithm/i,
    theme: { icon: NetworkIcon, tone: "violet", gradient: ["#6d4aff", "#2563eb"] },
  },
  {
    match: /מבוא למד|מבוא למדמ|intro/i,
    theme: { icon: SquareTerminalIcon, tone: "sky", gradient: ["#0f766e", "#10b981"] },
  },
  {
    match: /מערכות הפעלה|operating/i,
    theme: { icon: CpuIcon, tone: "blue", gradient: ["#1d4ed8", "#0284c7"] },
  },
  {
    match: /הסתברות|probab/i,
    theme: { icon: PercentIcon, tone: "sky", gradient: ["#1d4ed8", "#0284c7"] },
  },
  {
    match: /סטטיסטיקה|statist/i,
    theme: { icon: ChartColumnIcon, tone: "violet", gradient: ["#6d4aff", "#2563eb"] },
  },
  {
    match: /לינארית|linear/i,
    theme: { icon: Grid3x3Icon, tone: "violet", gradient: ["#6d4aff", "#2563eb"] },
  },
  {
    match: /חשבון|אינפי|מתמטיקה|דיסקרטית|calculus|math/i,
    theme: { icon: SigmaIcon, tone: "teal", gradient: ["#0f766e", "#14b8a6"] },
  },
  {
    match: /מחשב|תכנות|computer|program/i,
    theme: { icon: CodeXmlIcon, tone: "blue", gradient: ["#1e3a8a", "#2563eb"] },
  },
  {
    match: /פיזיקה|physics/i,
    theme: { icon: AtomIcon, tone: "blue", gradient: ["#1d4ed8", "#0284c7"] },
  },
  {
    match: /כימיה|chem/i,
    theme: { icon: FlaskConicalIcon, tone: "teal", gradient: ["#0f766e", "#14b8a6"] },
  },
  {
    match: /ביולוגיה|bio/i,
    theme: { icon: DnaIcon, tone: "success", gradient: ["#0f766e", "#10b981"] },
  },
  {
    match: /היסטוריה|hist/i,
    theme: { icon: LandmarkIcon, tone: "warning", gradient: ["#b45309", "#f59e0b"] },
  },
  {
    match: /אנגלית|שפ|english/i,
    theme: { icon: LanguagesIcon, tone: "rose", gradient: ["#be123c", "#f97316"] },
  },
];

const FALLBACKS: CourseTheme[] = [
  { icon: BookOpenIcon, tone: "blue", gradient: ["#1e3a8a", "#2563eb"] },
  { icon: BookOpenIcon, tone: "violet", gradient: ["#6d4aff", "#2563eb"] },
  { icon: BookOpenIcon, tone: "teal", gradient: ["#0f766e", "#14b8a6"] },
  { icon: BookOpenIcon, tone: "sky", gradient: ["#1d4ed8", "#0284c7"] },
];

export function courseTheme(name: string, seed = name): CourseTheme {
  return (
    RULES.find((r) => r.match.test(name))?.theme ??
    FALLBACKS[hashString(seed) % FALLBACKS.length]
  );
}
