// Part-to-whole of the student's active courses by department
// (Progress.dc.html "פילוח לפי מחלקה"). Fixed palette order, never cycled;
// >5 subjects fold into "אחר". The legend carries name + %, so identity never
// relies on color alone.
const PALETTE = ["#2563EB", "#0D9488", "#6D4AFF", "#F59E0B", "#0369A1"];

export function SubjectDonut({ subjects }: { subjects: { name: string; count: number }[] }) {
  const sorted = [...subjects].sort((a, b) => b.count - a.count);
  const folded =
    sorted.length > PALETTE.length
      ? [
          ...sorted.slice(0, PALETTE.length - 1),
          {
            name: "אחר",
            count: sorted.slice(PALETTE.length - 1).reduce((s, x) => s + x.count, 0),
          },
        ]
      : sorted;
  const total = folded.reduce((s, x) => s + x.count, 0);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground">הירשמו לקורס כדי לראות פילוח.</p>;
  }

  const r = 56;
  const c = 2 * Math.PI * r;
  const gap = folded.length > 1 ? 5.9 : 0;
  const segments = folded.map((s, i) => {
    const len = (s.count / total) * c;
    const start = folded.slice(0, i).reduce((sum, x) => sum + (x.count / total) * c, 0);
    return { name: s.name, color: PALETTE[i], drawn: Math.max(len - gap, 0), start };
  });

  return (
    <div className="flex flex-col items-center gap-7 sm:flex-row">
      <div className="relative size-[140px] shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#EEF2F8" strokeWidth="18" />
          {segments.map((seg) => (
            <circle
              key={seg.name}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="18"
              strokeDasharray={`${seg.drawn} ${c}`}
              strokeDashoffset={-seg.start}
              transform="rotate(-90 70 70)"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[32px] leading-none font-extrabold">{total}</span>
          <span className="text-xs text-muted-foreground">קורסים</span>
        </div>
      </div>

      <ul className="flex w-full grow flex-col gap-3.5" aria-label="פילוח קורסים לפי מחלקה">
        {folded.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2.5 text-[15px]">
            <span className="size-3 shrink-0 rounded" style={{ background: PALETTE[i] }} />
            <span className="grow">{s.name}</span>
            <span className="sr-only">{s.count} קורסים,</span>
            <span className="font-bold tabular-nums">{Math.round((s.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
