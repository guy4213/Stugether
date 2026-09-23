// Static placeholder numbers matching the mockup — the only aggregate query
// that exists (admin_global_stats RPC) is super-admin gated and cannot back
// a public pre-login page. See TASKS.md follow-up if real counts are wanted.
const STATS = [
  { value: "10,000+", label: "סטודנטים" },
  { value: "500+", label: "מורים פרטיים" },
  { value: "200+", label: "קורסים" },
  { value: "50+", label: "קבוצות לימוד" },
] as const;

export function StatsRow() {
  return (
    <section className="border-b border-border/60 bg-card/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-2xl font-bold text-primary sm:text-3xl">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
