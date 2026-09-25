// Static banner only — no upload/change control of any kind (firm client
// instruction: "don't allow cover changes, remove the button").
export function ProfileCover() {
  return (
    <div
      aria-hidden
      className="relative h-36 w-full overflow-hidden rounded-t-2xl bg-linear-to-l from-[oklch(0.62_0.14_290)] via-[oklch(0.62_0.12_240)] to-[oklch(0.72_0.13_175)] sm:h-44"
    >
      <div className="absolute start-1/4 -top-10 size-40 rotate-12 rounded-3xl bg-white/10" />
      <div className="absolute start-2/3 -bottom-16 size-48 -rotate-12 rounded-3xl bg-white/10" />
      <div className="absolute end-10 top-6 size-16 rounded-full bg-white/15" />
    </div>
  );
}
