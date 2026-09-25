// Messages the student sent per week, drawn like Progress.dc.html: gradient
// line + soft area, white-dot markers, a dashed guide + dark callout on the
// peak week, y-axis labels on the (RTL start) right side. Newest week sits at
// the left end, since the chart reads right-to-left.
const W = 760;
const H = 262;
const LEFT = 30;
const RIGHT = 690;
const TOP = 22;
const BOTTOM = 230;

function weekLabel(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
  }).formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${day}.${month}`;
}

export function ActivityChart({ weekly }: { weekly: { weekStart: string; count: number }[] }) {
  const n = weekly.length;
  const max = Math.max(4, ...weekly.map((w) => w.count));
  const niceMax = Math.ceil(max / 4) * 4;
  const x = (i: number) => (n === 1 ? (LEFT + RIGHT) / 2 : RIGHT - (i / (n - 1)) * (RIGHT - LEFT));
  const y = (v: number) => BOTTOM - (v / niceMax) * (BOTTOM - TOP);

  const points = weekly.map((w, i) => [x(i), y(w.count)] as const);
  const line = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px} ${py}`).join(" ");
  const area = `${line} L${points.at(-1)![0]} ${BOTTOM} L${points[0][0]} ${BOTTOM} Z`;
  const peak = weekly.reduce((best, w, i) => (w.count > weekly[best].count ? i : best), 0);
  const hasPeak = weekly[peak].count > 0;
  const ticks = [0, 1, 2, 3, 4].map((k) => (niceMax / 4) * k);
  const labelEvery = n > 10 ? Math.ceil(n / 8) : 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`הודעות לפי שבוע: ${weekly.map((w) => w.count).join(", ")}${
        hasPeak ? ` — שיא של ${weekly[peak].count} בשבוע ${weekLabel(weekly[peak].weekStart)}` : ""
      }`}
    >
      <defs>
        <linearGradient id="pgArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2563EB" stopOpacity=".28" />
          <stop offset="1" stopColor="#0D9488" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pgLine" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#0D9488" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      <g stroke="#EEF2F8" strokeWidth="1">
        {ticks.map((t) => (
          <path key={t} d={`M${LEFT} ${y(t)}H${RIGHT}`} />
        ))}
      </g>
      <g fontFamily="inherit" fontSize="12" fill="#5B6781" textAnchor="start">
        {ticks.map((t) => (
          <text key={t} x={RIGHT + 12} y={y(t) + 4}>
            {t}
          </text>
        ))}
      </g>

      <path d={area} fill="url(#pgArea)" />
      <path
        d={line}
        fill="none"
        stroke="url(#pgLine)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <g fill="#fff" stroke="#2563EB" strokeWidth="2.5">
        {points.map(([px, py], i) =>
          hasPeak && i === peak ? null : (
            <circle key={weekly[i].weekStart} cx={px} cy={py} r="5">
              <title>{`שבוע ${weekLabel(weekly[i].weekStart)}: ${weekly[i].count} הודעות`}</title>
            </circle>
          ),
        )}
      </g>

      {hasPeak && (
        <g>
          <path
            d={`M${points[peak][0]} ${points[peak][1] + 8}V${BOTTOM}`}
            stroke="#2563EB"
            strokeWidth="1.5"
            strokeDasharray="3 4"
          />
          <circle cx={points[peak][0]} cy={points[peak][1]} r="12" fill="#2563EB" opacity=".15" />
          <circle
            cx={points[peak][0]}
            cy={points[peak][1]}
            r="7"
            fill="#2563EB"
            stroke="#fff"
            strokeWidth="3"
          />
          <rect
            x={Math.min(Math.max(points[peak][0] - 40, 0), W - 80)}
            y={Math.max(points[peak][1] - 52, 0)}
            width="80"
            height="32"
            rx="10"
            fill="#0F1B33"
          />
          <text
            x={Math.min(Math.max(points[peak][0], 40), W - 40)}
            y={Math.max(points[peak][1] - 52, 0) + 21}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="#fff"
          >
            {weekly[peak].count} הודעות
          </text>
        </g>
      )}

      <g fontSize="12" fill="#5B6781" textAnchor="middle">
        {weekly.map((w, i) =>
          i % labelEvery === 0 || i === peak ? (
            <text
              key={w.weekStart}
              x={points[i][0]}
              y={H - 8}
              fill={hasPeak && i === peak ? "#1D4ED8" : undefined}
              fontWeight={hasPeak && i === peak ? 700 : undefined}
            >
              {weekLabel(w.weekStart)}
            </text>
          ) : null,
        )}
      </g>
    </svg>
  );
}
