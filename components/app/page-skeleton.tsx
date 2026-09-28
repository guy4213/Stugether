import { cn } from "cn";

// Instant placeholders for the (app) routes' loading.tsx files: the top nav
// stays put (it lives in the layout) and the page area shows a pulsing shape
// of what is coming while the server fetches the data.

function Block({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[22px] bg-muted", className)} />;
}

function Title() {
  return (
    <div className="flex flex-col gap-2">
      <Block className="h-4 w-32 rounded-full" />
      <Block className="h-9 w-72 max-w-full rounded-xl" />
    </div>
  );
}

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-label="טוען"
      className={cn(
        "mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 pt-7 pb-10 sm:px-8 xl:px-12",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function PageSkeleton({ variant }: { variant: "dashboard" | "grid" | "list" | "detail" }) {
  if (variant === "dashboard") {
    return (
      <Shell>
        <Title />
        <Block className="h-56" />
        <div className="flex flex-col gap-5 xl:flex-row">
          <div className="grid grow gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Block key={i} className="h-40" />
            ))}
          </div>
          <Block className="h-96 w-full shrink-0 xl:w-[340px]" />
        </div>
      </Shell>
    );
  }
  if (variant === "grid") {
    return (
      <Shell>
        <Block className="h-48 rounded-[28px]" />
        <Block className="h-11 w-full max-w-xl rounded-2xl" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} className="h-64" />
          ))}
        </div>
      </Shell>
    );
  }
  if (variant === "detail") {
    return (
      <Shell>
        <Block className="h-60 rounded-[28px]" />
        <div className="flex flex-col gap-5 xl:flex-row">
          <div className="flex grow flex-col gap-5">
            <Block className="h-48" />
            <Block className="h-72" />
          </div>
          <Block className="h-96 w-full shrink-0 xl:w-[380px]" />
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <Title />
      <Block className="h-11 w-full max-w-md rounded-2xl" />
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="flex grow flex-col gap-2 rounded-[22px] border border-border bg-card p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Block key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
        <Block className="h-80 w-full shrink-0 xl:w-[380px]" />
      </div>
    </Shell>
  );
}

// The room keeps its chat frame so the switch into it doesn't jump.
export function RoomSkeleton() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      aria-label="טוען"
      className="mx-auto flex h-[calc(100dvh-73px)] w-full max-w-4xl flex-col px-0 sm:px-6 sm:py-6"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card shadow-card sm:rounded-[22px] sm:border sm:border-border">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Block className="h-6 w-6 rounded-lg" />
          <div className="flex grow flex-col gap-1.5">
            <Block className="h-4 w-40 rounded-full" />
            <Block className="h-3 w-24 rounded-full" />
          </div>
          <Block className="h-9 w-28 rounded-xl" />
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 p-6">
          <Block className="h-12 w-2/3 rounded-2xl" />
          <Block className="h-12 w-1/2 self-end rounded-2xl" />
          <Block className="h-20 w-3/4 rounded-2xl" />
        </div>
        <div className="border-t border-border p-4">
          <Block className="h-11 rounded-full" />
        </div>
      </div>
    </main>
  );
}

// For a loading.tsx nested in a layout that already renders <main> (admin).
export function ContentSkeleton() {
  return (
    <div aria-busy="true" aria-label="טוען" className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Block key={i} className="h-24" />
        ))}
      </div>
      <Block className="h-80" />
    </div>
  );
}
