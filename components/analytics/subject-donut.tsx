// Part-to-whole of the student's active courses by department. Categorical
// palette validated with the dataviz validator (fixed order, never cycled;
// >5 subjects fold into "אחר"). Legend always shows name + count + %, so
// identity never relies on color alone (orange is low-contrast on white).
const PALETTE = ["#1f6fd1", "#14a38b", "#8b5cf6", "#e8870e", "#d9467b"];

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

  const r = 42;
  const c = 2 * Math.PI * r;
  // 2px surface gap between segments (only when there's >1 segment)
  const gap = folded.length > 1 ? 1.2 : 0;
  const segments = folded.map((s, i) => {
    const len = (s.count / total) * c;
    const start = folded.slice(0, i).reduce((sum, x) => sum + (x.count / total) * c, 0);
    return { name: s.name, color: PALETTE[i], drawn: Math.max(len - gap, 0), start };
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          {segments.map((seg) => (
            <circle
              key={seg.name}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${seg.drawn} ${c - seg.drawn}`}
              strokeDashoffset={-seg.start}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-xs text-muted-foreground">קורסים</span>
        </div>
      </div>

      <ul className="w-full space-y-2" aria-label="פילוח קורסים לפי מחלקה">
        {folded.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: PALETTE[i] }} />
            <span className="flex-1">{s.name}</span>
            <span className="text-muted-foreground tabular-nums">{s.count}</span>
            <span className="w-10 text-end font-medium tabular-nums">
              {Math.round((s.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
