import type { TopicWithState } from "@/lib/courses/topic-state";

// Node slots of the mockup's topic map (Hybrid.dc.html, 300×150): a root, two
// children and four grandchildren, filled in syllabus order.
const SLOTS = [
  { x: 150, y: 30, r: 17 },
  { x: 90, y: 72, r: 12 },
  { x: 210, y: 72, r: 12 },
  { x: 55, y: 118, r: 10 },
  { x: 118, y: 118, r: 10 },
  { x: 182, y: 118, r: 10 },
  { x: 245, y: 118, r: 10 },
];
const PARENT = [-1, 0, 0, 1, 1, 2, 2];

// Seven consecutive topics, positioned so the current one lands in the
// "active" slot (index 5, as drawn) when there is enough history before it.
function windowOf(topics: TopicWithState[]): TopicWithState[] {
  const currentIdx = topics.findIndex((t) => t.state === "current");
  const start = Math.max(0, Math.min((currentIdx === -1 ? 0 : currentIdx) - 5, topics.length - 7));
  return topics.slice(start, start + 7);
}

export function TopicTree({
  topics,
  mastered,
  total,
}: {
  topics: TopicWithState[];
  mastered: number;
  total: number;
}) {
  const shown = windowOf(topics);
  const upcoming = topics.filter((t) => t.state === "upcoming").length;
  const current = topics.filter((t) => t.state === "current" || t.state === "started").length;

  return (
    <div className="relative h-[150px] w-[300px] shrink-0 rounded-[20px] bg-[linear-gradient(160deg,#eef4ff,#ecfbf6)]">
      <svg
        width="300"
        height="150"
        viewBox="0 0 300 150"
        role="img"
        aria-label={`מפת נושאים: ${mastered} נשלטו, ${current} פעיל, ${upcoming} בהמשך`}
      >
        {shown.map((t, i) => {
          if (i === 0) return null;
          const p = SLOTS[PARENT[i]];
          const c = SLOTS[i];
          const dashed = t.state === "upcoming";
          return (
            <path
              key={`e-${t.id}`}
              d={`M${p.x} ${p.y} L${c.x} ${c.y}`}
              stroke={dashed ? "#C9D6EA" : "#9DBDF7"}
              strokeWidth="2"
              strokeDasharray={dashed ? "4 4" : undefined}
            />
          );
        })}
        {shown.map((t, i) => {
          const s = SLOTS[i];
          if (t.state === "current") {
            return (
              <g key={t.id}>
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={s.r + 4}
                  fill="#2563EB"
                  opacity=".35"
                  className="origin-center animate-live-pulse [transform-box:fill-box] motion-reduce:animate-none"
                />
                <circle cx={s.x} cy={s.y} r={s.r} fill="#1D4ED8">
                  <title>{t.title}</title>
                </circle>
              </g>
            );
          }
          if (t.state === "upcoming") {
            return (
              <circle key={t.id} cx={s.x} cy={s.y} r={s.r} fill="#fff" stroke="#C9D6EA" strokeWidth="2">
                <title>{t.title}</title>
              </circle>
            );
          }
          const fill = t.state === "started" ? "#3B82F6" : "#14B8A6";
          return (
            <g key={t.id}>
              <circle cx={s.x} cy={s.y} r={s.r} fill={fill}>
                <title>{t.title}</title>
              </circle>
              {t.state === "mastered" && (
                <path
                  d={`M${s.x - 5} ${s.y}l3.5 3.5 6.5-7`}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          );
        })}
      </svg>
      <span className="absolute top-2.5 left-3 rounded-full bg-white px-2.5 py-[3px] text-xs font-bold text-success-ink shadow-soft">
        {mastered}/{total} נושאים
      </span>
    </div>
  );
}
