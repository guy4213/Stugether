import {
  BookOpenIcon,
  GraduationCapIcon,
  MessageSquareIcon,
  SparklesIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { HeroSearch } from "@/components/landing/hero-search";

// Static placeholder numbers matching the mockup — the only aggregate query
// (admin_global_stats) is super-admin gated and can't back a public page.
const STATS: { icon: LucideIcon; value: string; label: string }[] = [
  { icon: UsersIcon, value: "10K+", label: "סטודנטים" },
  { icon: GraduationCapIcon, value: "500+", label: "מורים" },
  { icon: BookOpenIcon, value: "200+", label: "קורסים" },
  { icon: MessageSquareIcon, value: "50+", label: "חדרי לימוד" },
];

// The mockup has a student photo here; we have no imagery, so this is a
// composed preview of the product itself (a study room + match + progress).
function HeroIllustration() {
  return (
    <div aria-hidden className="relative mx-auto hidden h-[380px] w-full max-w-md md:block">
      <div className="absolute inset-x-6 top-8 rounded-3xl bg-white/95 p-5 text-foreground shadow-2xl shadow-black/30">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquareIcon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">הכנה למבחן — עצים</p>
            <p className="text-xs text-muted-foreground">מבני נתונים · 3 משתתפים</p>
          </div>
        </div>
        <div className="space-y-2.5 text-xs">
          <div className="w-fit max-w-[75%] rounded-2xl rounded-ss-sm bg-muted px-3 py-2">
            מתי עושים רוטציה כפולה ב-AVL?
          </div>
          <div className="ms-auto w-fit max-w-[80%] rounded-2xl rounded-se-sm bg-[oklch(0.94_0.05_175)] px-3 py-2">
            <span className="mb-0.5 flex items-center gap-1 font-semibold text-[oklch(0.4_0.1_180)]">
              <SparklesIcon className="size-3" /> עוזר AI
            </span>
            כשחוסר האיזון הוא בזיגזג (LR / RL)...
          </div>
          <div className="w-fit max-w-[70%] rounded-2xl rounded-ss-sm bg-primary px-3 py-2 text-primary-foreground">
            מעולה, ננסה את הדוגמה!
          </div>
        </div>
      </div>

      <div className="absolute -start-2 bottom-6 w-52 rounded-2xl bg-white p-4 text-foreground shadow-xl shadow-black/25">
        <p className="text-xs text-muted-foreground">התאמה ללמידה משותפת</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-2xl font-bold text-primary">92%</span>
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {["נכ", "אל", "מפ"].map((i, idx) => (
              <span
                key={i}
                className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white"
                style={{ background: ["#1f6fd1", "#14a38b", "#8b5cf6"][idx] }}
              >
                {i}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -end-2 bottom-0 w-44 rounded-2xl bg-white p-4 text-foreground shadow-xl shadow-black/25">
        <p className="text-xs text-muted-foreground">מבני נתונים</p>
        <p className="mt-1 text-lg font-bold">65%</p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[65%] rounded-full bg-linear-to-l from-primary to-secondary" />
        </div>
      </div>

      <div className="absolute -end-4 -top-2 flex size-28 items-center justify-center rounded-full bg-[oklch(0.3_0.1_260)] p-3 text-center text-sm leading-tight font-bold text-white shadow-xl ring-4 ring-white/10">
        אותן מטרות,
        <br />
        ביחד יותר
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-bl from-[oklch(0.2_0.06_262)] via-[oklch(0.3_0.12_258)] to-[oklch(0.45_0.17_250)] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute start-1/3 -top-24 size-96 rounded-full bg-[oklch(0.6_0.18_240)] opacity-30 blur-3xl" />
        <div className="absolute end-10 bottom-10 size-72 rounded-full bg-[oklch(0.7_0.15_175)] opacity-20 blur-3xl" />
        <div className="absolute end-1/3 top-32 size-4 rounded-full bg-[oklch(0.8_0.14_175)]" />
        <div className="absolute start-20 top-20 size-3 rounded-full bg-[oklch(0.75_0.15_240)]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-36 sm:px-6 md:grid-cols-2 md:pt-20">
        <div className="space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm backdrop-blur">
            <SparklesIcon className="size-4 text-[oklch(0.85_0.12_175)]" />
            חדרי לימוד עם עוזר AI מובנה
          </span>
          <h1 className="text-5xl leading-[1.1] font-extrabold tracking-tight sm:text-6xl">
            סטודנטים
            <br />
            <span className="bg-linear-to-l from-[oklch(0.85_0.12_175)] to-[oklch(0.8_0.12_235)] bg-clip-text text-transparent">
              לומדים ביחד
            </span>
          </h1>
          <p className="max-w-md text-lg text-white/75">
            מצאו שותפים ללמידה, הצטרפו לחדרי לימוד בקורסים שלכם וקבלו עזרה מעוזר AI — הכול במקום
            אחד.
          </p>

          <HeroSearch />

          <dl className="grid max-w-lg grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="flex items-center gap-2">
                  <s.icon className="size-5 text-[oklch(0.85_0.12_175)]" />
                  <span className="text-2xl font-bold">{s.value}</span>
                </dd>
                <p aria-hidden className="text-sm text-white/65">
                  {s.label}
                </p>
              </div>
            ))}
          </dl>
        </div>

        <HeroIllustration />
      </div>

      <svg
        aria-hidden
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-24 w-full fill-background"
      >
        <path d="M0,64 C240,120 480,120 720,80 C960,40 1200,0 1440,40 L1440,120 L0,120 Z" />
      </svg>
    </section>
  );
}
