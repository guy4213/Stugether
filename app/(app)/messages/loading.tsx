export default function Loading() {
  return (
    <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-4 px-4 pt-7 pb-10 sm:px-8 lg:h-[calc(100dvh-73px)] lg:grid-cols-[360px_1fr] xl:px-12">
      <div className="h-80 animate-pulse rounded-[22px] bg-card shadow-card lg:h-full" />
      <div className="hidden animate-pulse rounded-[22px] bg-card shadow-card lg:block" />
    </main>
  );
}
