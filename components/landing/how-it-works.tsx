import { SearchIcon, UsersIcon, VideoIcon } from "lucide-react";

// Step numbers are a shade darker than in the design so they keep 4.5:1 on
// the page background.
const STEPS = [
  {
    n: "01",
    color: "text-primary",
    tile: "bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] shadow-[0_16px_30px_-14px_rgba(37,99,235,.8)]",
    icon: SearchIcon,
    title: "מוצאים קורס",
    text: "בוחרים מוסד ומחלקה ומוצאים את הקורסים שלכם בקלות.",
  },
  {
    n: "02",
    color: "text-[#146F92]",
    tile: "bg-brand-diag shadow-[0_16px_30px_-14px_rgba(20,120,160,.8)]",
    icon: UsersIcon,
    title: "מכירים שותפים",
    text: "רואים מי עוד בקורס ואחוזי התאמה לפי מוסד, שנה ועיר.",
  },
  {
    n: "03",
    color: "text-[#0B7A70]",
    tile: "bg-[linear-gradient(135deg,#0d9488,#10b981)] shadow-[0_16px_30px_-14px_rgba(13,148,136,.8)]",
    icon: VideoIcon,
    title: "לומדים ביחד",
    text: "פותחים חדר, מזמינים חברים ושואלים את עוזר ה-AI.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="mx-auto flex w-full max-w-[1440px] scroll-mt-6 flex-col items-center gap-14 px-5 pt-20 md:px-10 xl:px-[120px] xl:pt-[110px]"
    >
      <div className="flex flex-col items-center gap-2.5 text-center">
        <span className="text-gradient-brand text-sm font-bold tracking-[.5px]">
          3 צעדים · 3 דקות
        </span>
        <h2 id="how-title" className="text-[34px] font-extrabold tracking-[-1px] md:text-5xl">
          איך זה עובד?
        </h2>
      </div>
      <ol className="relative grid w-full grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
        <span
          aria-hidden
          className="absolute inset-x-[16%] top-11 hidden h-[3px] rounded-sm bg-[linear-gradient(270deg,#2563eb,#0d9488)] md:block"
        />
        {STEPS.map((s) => (
          <li key={s.n} className="relative flex flex-col items-center gap-4 text-center">
            <span
              aria-hidden
              className={`flex size-[88px] items-center justify-center rounded-[28px] border-6 border-background text-white ${s.tile}`}
            >
              <s.icon className="size-[34px]" strokeWidth={2} />
            </span>
            <span aria-hidden className={`text-[13px] font-extrabold ${s.color}`}>
              {s.n}
            </span>
            <h3 className="text-[22px] font-bold">{s.title}</h3>
            <p className="max-w-[300px] text-base leading-[1.6] text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
