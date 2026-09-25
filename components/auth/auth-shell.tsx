import Link from "next/link";
import { BarChart3Icon, SparklesIcon, UsersIcon, type LucideIcon } from "lucide-react";

const POINTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: UsersIcon, title: "קהילת לומדים", text: "חדרי לימוד עם סטודנטים מהקורסים שלכם" },
  { icon: SparklesIcon, title: "עוזר AI", text: "הסברים ותשובות בתוך כל חדר" },
  { icon: BarChart3Icon, title: "מעקב התקדמות", text: "רואים איפה אתם עומדים בכל קורס" },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-linear-to-bl from-[oklch(0.2_0.06_262)] via-[oklch(0.3_0.12_258)] to-[oklch(0.45_0.17_250)] p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute -start-24 -top-24 size-96 rounded-full bg-[oklch(0.6_0.18_240)] opacity-30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -end-20 -bottom-20 size-80 rounded-full bg-[oklch(0.7_0.15_175)] opacity-20 blur-3xl"
        />
        <Link href="/" className="relative text-3xl font-bold">
          StuGether
        </Link>
        <div className="relative my-auto space-y-8">
          <h2 className="text-4xl leading-tight font-extrabold">
            אותן מטרות,
            <br />
            ביחד יותר.
          </h2>
          <ul className="space-y-4">
            {POINTS.map((p) => (
              <li
                key={p.title}
                className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <p.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{p.title}</span>
                  <span className="block text-sm text-white/70">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main id="main-content" className="flex items-center justify-center bg-muted/40 p-4 sm:p-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 block text-center text-3xl font-bold text-primary lg:hidden"
          >
            StuGether
          </Link>
          <div className="rounded-3xl bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
