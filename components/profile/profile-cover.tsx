// Static banner only — no upload/change control of any kind (firm client
// instruction: "don't allow cover changes, remove the button").
export function ProfileCover() {
  return (
    <div
      aria-hidden
      className="h-32 w-full rounded-t-xl bg-gradient-to-l from-primary to-secondary sm:h-40"
    />
  );
}
