// Static banner only — no upload/change control of any kind (firm client
// instruction: "don't allow cover changes, remove the button"), so the
// mockup's "עריכת רקע" button is intentionally left out.
export function ProfileCover() {
  return (
    <div
      aria-hidden
      className="relative h-[170px] overflow-hidden bg-[linear-gradient(100deg,#10B9A0_0%,#2A9BC9_40%,#3B82F6_70%,#7C5CFF_100%)]"
    >
      <span className="absolute top-5 left-[60px] size-[90px] rounded-full bg-white/14" />
      <span className="absolute top-[30px] left-[220px] size-[190px] -rotate-[14deg] rounded-[40px] bg-white/10" />
      <span className="absolute -top-[60px] left-[640px] size-40 rotate-12 rounded-[36px] bg-white/10" />
    </div>
  );
}
