import {
  BookOpenIcon,
  GraduationCapIcon,
  MessageSquareIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react";
import { SiteNav } from "@/components/landing/site-nav";
import { HeroSearch } from "@/components/landing/hero-search";
import { ProgressRing } from "@/components/ui/progress-ring";

// Marketing figures from the design, kept static on purpose: live counts of
// students/rooms aren't readable anonymously (RLS), and a small dev catalog
// would read worse than no number.
const STATS = [
  { value: "+10K", label: "סטודנטים", icon: UsersIcon },
  { value: "+500", label: "מוסדות", icon: GraduationCapIcon },
  { value: "+200", label: "קורסים", icon: BookOpenIcon },
  { value: "+50", label: "חדרים חיים", icon: VideoIcon },
];

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z" />
    </svg>
  );
}

// Hero per Landing.dc.html: nav inside, headline + search + stats on the
// start side, a photo arch with floating product cards on the end side, and
// a sweeping wave into the page background.
export function HeroSection({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="relative overflow-hidden bg-landing-hero text-white lg:h-[860px] xl:h-[900px]">
      <HeroVisual />
      <SiteNav isAuthed={isAuthed} />

      <div className="relative z-10 mx-auto max-w-[1440px] px-5 pt-10 pb-40 md:px-10 md:pt-16 lg:pb-0 xl:px-16 xl:pt-20">
        <div className="flex max-w-[620px] flex-col gap-[26px] lg:max-w-[520px] xl:max-w-[620px]">
          <span className="flex h-9 items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-3.5 text-sm font-semibold">
            <Sparkle className="size-4 text-[#5EEAD4]" />
            חדרי לימוד עם עוזר AI מובנה
          </span>
          <h1 className="text-5xl leading-none font-black tracking-[-1.5px] md:text-[64px] xl:text-[88px] xl:tracking-[-2.5px]">
            סטודנטים
            <br />
            <span className="text-gradient-aqua">לומדים ביחד</span>
          </h1>
          <p className="max-w-[540px] text-lg leading-[1.6] text-white/85 md:text-xl">
            מצאו שותפים ללמידה, הצטרפו לחדרי לימוד בקורסים שלכם וקבלו עזרה מ-AI — הכול במקום אחד.
          </p>
          <HeroSearch />
          <dl className="grid grid-cols-2 gap-2.5 sm:flex">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="flex grow items-center gap-2.5 rounded-2xl border border-white/16 bg-white/8 px-3.5 py-3"
              >
                <span
                  aria-hidden
                  className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(94,234,212,.18)] text-[#5EEAD4]"
                >
                  <s.icon className="size-[17px]" strokeWidth={2} />
                </span>
                <div className="flex flex-col-reverse">
                  <dt className="text-xs text-white/75">{s.label}</dt>
                  <dd className="text-[22px] leading-[1.1] font-extrabold">{s.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* sweeping bottom edge */}
      <svg
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        aria-hidden
        className="pointer-events-none absolute -bottom-px left-0 h-24 w-full md:h-36 xl:h-[220px]"
      >
        <defs>
          <linearGradient id="ldEdge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5EEAD4" />
            <stop offset=".5" stopColor="#38BDF8" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <path
          d="M0 150 C 260 230, 620 210, 900 140 S 1300 20, 1440 70"
          fill="none"
          stroke="url(#ldEdge)"
          strokeWidth="6"
          opacity=".9"
        />
        <path
          d="M0 150 C 260 230, 620 210, 900 140 S 1300 20, 1440 70 V220 H0 Z"
          className="fill-background"
        />
      </svg>
    </section>
  );
}

// Decorative arch + floating cards (physical left in the design, so these use
// left-* on purpose). Desktop only; phones get the text column alone.
function HeroVisual() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[1440px] -translate-x-1/2 lg:block"
    >
      <div className="absolute inset-y-0 left-0 w-[680px] origin-top-left scale-[.82] xl:scale-100">
        <span className="absolute top-[170px] left-[610px] size-[22px] rounded-full bg-[#38BDF8] opacity-70" />
        <span className="absolute top-[130px] left-[700px] size-3 rounded-full bg-[#5EEAD4] opacity-80" />
        <span className="absolute top-[220px] left-[690px] size-2 rounded-full bg-[#93C5FD] opacity-80" />
        <svg
          viewBox="0 0 260 160"
          width="260"
          height="160"
          className="absolute top-24 left-[360px]"
        >
          <path
            d="M10 120c30-40 60-10 80-40s10-60 40-60 20 60 50 50 30-50 60-40"
            fill="none"
            stroke="#5EEAD4"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".85"
          />
          <path
            d="M40 150c20-10 40 0 55-15"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity=".7"
          />
          <ellipse
            cx="228"
            cy="30"
            rx="14"
            ry="22"
            transform="rotate(35 228 30)"
            fill="none"
            stroke="#E0F2FE"
            strokeWidth="3"
            opacity=".8"
          />
        </svg>

        {/* photo arch — TODO: swap the silhouette for a real students photo */}
        <div className="absolute top-[150px] left-10 h-[760px] w-[600px] rounded-t-[300px] bg-[linear-gradient(180deg,rgba(94,234,212,.7),rgba(56,189,248,.25)_60%,rgba(56,189,248,0))] p-2.5">
          <div className="relative flex size-full items-center justify-center overflow-hidden rounded-t-[290px] bg-[linear-gradient(160deg,#3B82F6_0%,#1E6FD0_45%,#129B9A_100%)]">
            <svg width="200" height="140" viewBox="0 0 200 140" className="opacity-35">
              <circle cx="100" cy="42" r="26" fill="#fff" />
              <path d="M52 138c0-30 22-54 48-54s48 24 48 54z" fill="#fff" />
              <circle cx="38" cy="58" r="20" fill="#fff" />
              <path d="M0 138c0-24 17-42 38-42 10 0 19 4 26 11-8 10-12 20-12 31z" fill="#fff" />
              <circle cx="162" cy="58" r="20" fill="#fff" />
              <path d="M200 138c0-24-17-42-38-42-10 0-19 4-26 11 8 10 12 20 12 31z" fill="#fff" />
            </svg>
            <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,44,127,.55)_0%,rgba(11,44,127,0)_40%)]" />
          </div>
        </div>

        <div className="absolute top-[118px] left-[470px] flex size-[150px] items-center justify-center rounded-full border-4 border-[rgba(94,234,212,.55)] bg-[#0A2470] text-center text-[19px] leading-[1.15] font-extrabold shadow-[0_20px_40px_-16px_rgba(2,12,40,.7)]">
          אותן
          <br />
          מטרות,
          <br />
          <span className="text-[#5EEAD4]">ביחד</span>
        </div>

        <div className="absolute top-[560px] left-[90px] flex w-[290px] flex-col gap-2.5 rounded-[20px] bg-white/95 px-4 py-3.5 text-foreground shadow-[0_28px_56px_-24px_rgba(2,12,40,.7)] motion-safe:animate-float">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-brand-diag text-white">
              <MessageSquareIcon className="size-[17px]" strokeWidth={2} />
            </span>
            <div className="flex grow flex-col">
              <span className="text-sm font-bold">הכנה למבחן — עצים</span>
              <span className="text-xs text-muted-foreground">מבני נתונים · 3 משתתפים</span>
            </div>
            <span className="flex items-center gap-[5px] rounded-full bg-success-soft px-2 py-[3px] text-[11px] font-bold text-success-ink">
              <span className="size-1.5 rounded-full bg-success" />
              LIVE
            </span>
          </div>
          <span className="flex flex-col gap-0.5 self-end rounded-[14px_14px_4px_14px] bg-success-soft px-3 py-2 text-[13px]">
            <strong className="text-xs text-success-ink">עוזר AI</strong>
            רוטציה ב-AVL היא O(1)
          </span>
        </div>

        <div className="absolute top-[700px] left-[400px] flex w-[210px] items-center gap-3 rounded-[18px] bg-white/95 px-3.5 py-3 text-foreground shadow-[0_24px_48px_-20px_rgba(2,12,40,.7)] motion-safe:animate-float-slow">
          <ProgressRing value={92} size={48} stroke={6} from="#0D9488" to="#0D9488" track="#E7F8F3">
            <span className="text-xs font-extrabold">92%</span>
          </ProgressRing>
          <div className="flex flex-col">
            <span className="text-sm font-bold">התאמה ללמידה</span>
            <span className="text-xs text-muted-foreground">3 שותפים בקורס</span>
          </div>
        </div>
      </div>
    </div>
  );
}
