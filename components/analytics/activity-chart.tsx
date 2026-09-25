// Single-series area chart: messages the student sent per week (real data).
// One series → no legend; the card title names it. Native <title> on each
// point gives a hover tooltip + screen-reader text without a chart library.
const W = 640;
const H = 220;
const PAD = { top: 24, right: 16, bottom: 28, left: 32 };

function weekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

export function ActivityChart({ weekly }: { weekly: { weekStart: string; count: number }[] }) {
  const max = Math.max(4, ...weekly.map((w) => w.count));
  const niceMax = Math.ceil(max / 4) * 4;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  // Chart reads right-to-left in RTL: newest week on the left end.
  const x = (i: number) => PAD.left + innerW - (i / (weekly.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH;

  const points = weekly.map((w, i) => [x(i), y(w.count)] as const);
  const line = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px},${py}`).join(" ");
  const area = `${line} L${points.at(-1)![0]},${y(0)} L${points[0][0]},${y(0)} Z`;
  const peakIndex = weekly.reduce((best, w, i) => (w.count > weekly[best].count ? i : best), 0);
  const ticks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`הודעות לפי שבוע: ${weekly.map((w) => `${weekLabel(w.weekStart)}: ${w.count}`).join(", ")}`}
      >
        <defs>
          <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeDasharray={t === 0 ? undefined : "3 4"}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {t}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#activity-fill)" />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />

        {points.map(([px, py], i) => (
          <g key={weekly[i].weekStart}>
            <circle cx={px} cy={py} r={14} fill="transparent">
              <title>{`שבוע ${weekLabel(weekly[i].weekStart)}: ${weekly[i].count} הודעות`}</title>
            </circle>
            <circle
              cx={px}
              cy={py}
              r={4}
              fill="var(--card)"
              stroke="var(--primary)"
              strokeWidth={2}
              pointerEvents="none"
            />
            <text
              x={px}
              y={H - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {weekLabel(weekly[i].weekStart)}
            </text>
          </g>
        ))}

        {weekly[peakIndex].count > 0 && (
          <text
            x={points[peakIndex][0]}
            y={points[peakIndex][1] - 12}
            textAnchor="middle"
            className="fill-foreground text-[12px] font-semibold"
          >
            {weekly[peakIndex].count}
          </text>
        )}
      </svg>
    </figure>
  );
}
