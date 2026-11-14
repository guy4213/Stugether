// One metric per day as thin bars (small multiples: each usage chart shows a
// single series on its own axis — never two scales on one chart). The chart
// reads right-to-left like the rest of the UI: the oldest day is at the right
// end, today at the left. Every day has a full-height hover target with a
// native tooltip; the exact numbers are also in the table view on the page.
const W = 640;
const H = 170;
const PLOT_START = 600; // right edge of the plot (RTL start)
const PLOT_END = 8; // left edge
const TOP = 14;
const BOTTOM = 140;

export function dayLabel(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(date)}.${Number(month)}`;
}

export function UsageBarChart({
  title,
  total,
  unit,
  data,
  format = String,
}: {
  title: string;
  total: string;
  unit: string;
  data: { day: string; value: number }[];
  // Axis and tooltip formatting (e.g. currency); counts by default.
  format?: (value: number) => string;
}) {
  const n = data.length;
  const peakValue = Math.max(0, ...data.map((d) => d.value));
  const max = peakValue > 0 ? peakValue : 1;
  const slot = (PLOT_START - PLOT_END) / Math.max(n, 1);
  const gap = n > 45 ? 1 : 2;
  const barWidth = Math.max(slot - gap, 1);
  // Slot i (oldest first) sits at the right; the newest day at the left.
  const slotX = (i: number) => PLOT_START - (i + 1) * slot;
  const y = (v: number) => BOTTOM - (v / max) * (BOTTOM - TOP);
  const labelIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);

  return (
    <figure className="flex flex-col gap-2 rounded-[22px] border border-border bg-white p-5 shadow-card">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted-foreground tabular-nums">{total}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${title}: ${total}. שיא של ${format(data[peak]?.value ?? 0)} ${unit} ב-${
          data[peak] ? dayLabel(data[peak].day) : ""
        }`}
      >
        <g className="stroke-border" strokeWidth="1">
          <path d={`M${PLOT_END} ${TOP}H${PLOT_START}`} strokeDasharray="3 4" />
          <path d={`M${PLOT_END} ${BOTTOM}H${PLOT_START}`} />
        </g>
        <g className="fill-muted-foreground" fontSize="12" textAnchor="start">
          <text x={PLOT_START + 8} y={TOP + 4}>
            {format(max)}
          </text>
          <text x={PLOT_START + 8} y={BOTTOM + 4}>
            0
          </text>
        </g>

        {data.map((d, i) => {
          const x = slotX(i) + gap / 2;
          const top = y(d.value);
          const h = BOTTOM - top;
          return (
            <g key={d.day} className="group">
              <title>{`${dayLabel(d.day)}: ${format(d.value)} ${unit}`.trim()}</title>
              <rect x={slotX(i)} y={TOP} width={slot} height={BOTTOM - TOP} fill="transparent" />
              {h > 0 && (
                <path
                  className="fill-primary transition-opacity group-hover:opacity-70"
                  d={roundedTopBar(x, top, barWidth, h, Math.min(4, barWidth / 2, h))}
                />
              )}
            </g>
          );
        })}

        <g className="fill-muted-foreground" fontSize="12" textAnchor="middle">
          {labelIdx.map((i) =>
            data[i] ? (
              <text key={data[i].day} x={slotX(i) + slot / 2} y={H - 8}>
                {dayLabel(data[i].day)}
              </text>
            ) : null,
          )}
        </g>
      </svg>
    </figure>
  );
}

// Bar anchored to the baseline: rounded data end (top), square base.
function roundedTopBar(x: number, top: number, w: number, h: number, r: number): string {
  const bottom = top + h;
  return [
    `M${x} ${bottom}`,
    `V${top + r}`,
    `Q${x} ${top} ${x + r} ${top}`,
    `H${x + w - r}`,
    `Q${x + w} ${top} ${x + w} ${top + r}`,
    `V${bottom}`,
    "Z",
  ].join(" ");
}
