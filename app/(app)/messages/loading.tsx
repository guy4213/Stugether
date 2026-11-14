export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col lg:h-[calc(100dvh-72px)] lg:px-8 lg:pt-6 lg:pb-7 xl:px-12">
      <div className="grid min-h-0 flex-1 bg-card lg:grid-cols-[360px_minmax(0,1fr)] lg:overflow-hidden lg:rounded-[28px] lg:shadow-[0_1px_2px_rgba(15,27,51,.04),0_40px_80px_-40px_rgba(15,27,51,.45)]">
        <div className="flex flex-col gap-[18px] px-4 pt-6 sm:px-[18px] lg:border-e lg:border-divider">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-track" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3.5 p-3">
              <div className="size-[50px] shrink-0 animate-pulse rounded-full bg-track" />
              <div className="flex grow flex-col gap-2">
                <div className="h-3.5 w-2/5 animate-pulse rounded bg-track" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-divider" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden bg-[#f6f8fc] lg:block" />
      </div>
    </main>
  );
}
