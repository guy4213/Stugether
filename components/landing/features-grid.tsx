import { BookOpenIcon, ChartColumnIcon, UsersIcon } from "lucide-react";

function AiSparkles({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z" />
      <path d="M19 15l1 2.6 2.5 1-2.5 1-1 2.4-1-2.4-2.5-1 2.5-1z" />
    </svg>
  );
}

const FEATURES = [
  {
    title: "חדרי לימוד",
    text: "לומדים יחד עם סטודנטים מהקורס שלכם, בזמן אמת.",
    tile: "bg-[linear-gradient(135deg,#0d9488,#10b981)] shadow-[0_12px_22px_-12px_rgba(13,148,136,.8)]",
    icon: <UsersIcon className="size-[26px]" strokeWidth={2} />,
  },
  {
    title: "עוזר AI",
    text: "תשובות והסברים בתוך החדר, בדיוק כשנתקעים.",
    tile: "bg-brand-diag shadow-[0_12px_22px_-12px_rgba(37,99,235,.8)]",
    icon: <AiSparkles className="size-[26px]" />,
  },
  {
    title: "קטלוג קורסים",
    text: "כל הקורסים של המוסד שלכם, במקום אחד.",
    tile: "bg-[linear-gradient(135deg,#1d4ed8,#0284c7)] shadow-[0_12px_22px_-12px_rgba(29,78,216,.8)]",
    icon: <BookOpenIcon className="size-[26px]" strokeWidth={2} />,
  },
  {
    title: "מעקב התקדמות",
    text: "רואים בדיוק איפה אתם עומדים בכל קורס.",
    tile: "bg-[linear-gradient(135deg,#6d4aff,#2563eb)] shadow-[0_12px_22px_-12px_rgba(109,74,255,.8)]",
    icon: <ChartColumnIcon className="size-[26px]" strokeWidth={2.2} />,
  },
];

// Four feature cards overlapping the hero's bottom wave.
export function FeaturesGrid() {
  return (
    <section
      id="features"
      aria-label="מה יש כאן"
      className="relative z-10 mx-auto -mt-10 grid w-full max-w-[1440px] scroll-mt-6 grid-cols-1 gap-5 px-5 sm:grid-cols-2 md:px-10 lg:grid-cols-4 xl:px-[120px]"
    >
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="flex flex-col gap-3.5 rounded-3xl border border-border bg-card px-6 py-7 shadow-[0_20px_40px_-26px_rgba(15,27,51,.4)]"
        >
          <span
            aria-hidden
            className={`flex size-[58px] items-center justify-center rounded-[18px] text-white ${f.tile}`}
          >
            {f.icon}
          </span>
          <h3 className="text-xl font-bold">{f.title}</h3>
          <p className="text-[15px] leading-[1.55] text-muted-foreground">{f.text}</p>
        </div>
      ))}
    </section>
  );
}
