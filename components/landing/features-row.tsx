import Link from "next/link";
import {
  BarChart3Icon,
  BookOpenIcon,
  SparklesIcon,
  UsersIcon,
  SearchIcon,
  DoorOpenIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES: { icon: LucideIcon; title: string; subtitle: string; tone: string }[] = [
  {
    icon: UsersIcon,
    title: "חדרי לימוד",
    subtitle: "לומדים יחד עם סטודנטים מהקורס",
    tone: "bg-[oklch(0.94_0.05_175)] text-[oklch(0.45_0.1_180)]",
  },
  {
    icon: SparklesIcon,
    title: "עוזר AI",
    subtitle: "תשובות והסברים בתוך החדר",
    tone: "bg-[oklch(0.94_0.04_250)] text-[oklch(0.45_0.17_255)]",
  },
  {
    icon: BookOpenIcon,
    title: "קטלוג קורסים",
    subtitle: "כל הקורסים של המוסד שלכם",
    tone: "bg-[oklch(0.94_0.04_230)] text-[oklch(0.45_0.14_230)]",
  },
  {
    icon: BarChart3Icon,
    title: "מעקב התקדמות",
    subtitle: "רואים בדיוק איפה אתם עומדים",
    tone: "bg-[oklch(0.94_0.04_295)] text-[oklch(0.45_0.17_295)]",
  },
];

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: SearchIcon,
    title: "מוצאים קורס",
    text: "בוחרים מוסד ומחלקה ומוצאים את הקורסים שלכם בקטלוג.",
  },
  {
    icon: UsersIcon,
    title: "מכירים שותפים",
    text: "רואים מי עוד בקורס ואחוז ההתאמה שלכם — מוסד, שנה, מחלקה ועיר.",
  },
  {
    icon: DoorOpenIcon,
    title: "לומדים ביחד",
    text: "פותחים חדר לימוד, מזמינים חברים ושואלים את עוזר ה-AI.",
  },
];

export function FeaturesRow() {
  return (
    <>
      <section id="features" className="relative z-10 mx-auto w-full -mt-20 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col items-center rounded-2xl bg-card p-6 text-center shadow-lg shadow-primary/5"
            >
              <span
                className={`mb-4 flex size-14 items-center justify-center rounded-2xl ${f.tone}`}
              >
                <f.icon className="size-7" />
              </span>
              <p className="font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-bold">איך זה עובד?</h2>
        <p className="mt-2 text-center text-muted-foreground">שלושה צעדים ואתם בפנים</p>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-border bg-card p-6">
              <span className="absolute start-6 -top-4 flex size-8 items-center justify-center rounded-full bg-linear-to-l from-primary to-[oklch(0.55_0.11_180)] text-sm font-bold text-white">
                {i + 1}
              </span>
              <s.icon className="mb-3 size-8 text-primary" />
              <p className="text-lg font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-l from-[oklch(0.3_0.12_258)] to-[oklch(0.45_0.17_250)] px-8 py-12 text-center text-white">
          <div
            aria-hidden
            className="absolute -start-16 -top-16 size-56 rounded-full bg-white/10"
          />
          <h2 className="relative text-3xl font-bold">מוכנים להתחיל ללמוד ביחד?</h2>
          <p className="relative mt-2 text-white/75">ההרשמה לוקחת פחות מדקה.</p>
          <Button
            asChild
            size="lg"
            className="relative mt-6 h-12 rounded-full bg-white px-8 text-base text-primary hover:bg-white/90"
          >
            <Link href="/signup">הרשמה חינם</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <span className="font-bold text-primary">StuGether</span>
        <span>© {new Date().getFullYear()} StuGether. כל הזכויות שמורות.</span>
      </div>
    </footer>
  );
}
