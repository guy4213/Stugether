import type { ReactNode } from "react";
import { cn } from "cn";

// "הודעות" as one window (design round 4, 12.11.2026): the conversation list
// and the open chat share a single rounded card on large screens. Below lg
// there is no window: the list (/messages) or the chat (/messages/[id]) fills
// the screen.
export function MessagesWindow({
  mode,
  children,
}: {
  /** "inbox" = /messages (list first on phones), "chat" = /messages/[id]. */
  mode: "inbox" | "chat";
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      className={cn(
        "mx-auto flex w-full max-w-[1440px] flex-col lg:h-[calc(100dvh-72px)] lg:min-h-[560px] lg:px-8 lg:pt-6 lg:pb-7 xl:px-12",
        mode === "chat" ? "h-[calc(100dvh-72px)] min-h-[440px]" : "flex-1",
      )}
    >
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] bg-card lg:grid-cols-[360px_minmax(0,1fr)] lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-[rgba(15,27,51,.05)] lg:shadow-[0_1px_2px_rgba(15,27,51,.04),0_40px_80px_-40px_rgba(15,27,51,.45)]">
        {children}
      </div>
    </main>
  );
}

// The chat column's backdrop: two soft brand halos on a pale blue.
export const CHAT_BACKDROP =
  "bg-[radial-gradient(700px_420px_at_100%_0%,rgba(37,99,235,.07),transparent_60%),radial-gradient(640px_420px_at_0%_100%,rgba(13,148,136,.07),transparent_60%)] bg-[#f6f8fc]";

// /messages on a large screen, before a conversation is picked.
export function NoConversationPane() {
  return (
    <section
      aria-label="לא נבחרה שיחה"
      className={cn(
        "hidden flex-col items-center justify-center gap-2.5 px-6 text-center lg:flex",
        CHAT_BACKDROP,
      )}
    >
      <div
        aria-hidden
        className="relative mb-5 h-[190px] w-[300px] motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      >
        <span className="absolute inset-x-10 inset-y-5 rounded-full bg-brand-diag opacity-[.22] blur-[46px]" />
        <FakeBubble
          className="start-2.5 top-2.5 rotate-[4deg] rounded-es-lg"
          avatar="bg-violet-soft"
          lines={[110, 70]}
        />
        <FakeBubble
          className="end-0 top-[74px] -rotate-[5deg] rounded-ee-lg bg-[linear-gradient(180deg,#3b7bf0,#2563eb)]"
          lines={[130, 90]}
          own
        />
        <FakeBubble
          className="start-[46px] top-[132px] rotate-[2deg] rounded-es-lg"
          avatar="bg-warning-soft"
          lines={[84, 56]}
        />
      </div>
      <h2 className="text-[30px] font-extrabold tracking-[-.8px]">בחרו שיחה</h2>
      <p className="text-[15px] text-muted-foreground">או התחילו שיחה חדשה עם מישהו מהקורסים שלך</p>
    </section>
  );
}

function FakeBubble({
  className,
  avatar,
  lines,
  own = false,
}: {
  className: string;
  avatar?: string;
  lines: number[];
  own?: boolean;
}) {
  return (
    <span
      className={cn(
        "absolute flex items-center gap-2.5 rounded-[22px] bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(15,27,51,.05),0_18px_36px_-18px_rgba(15,27,51,.4)]",
        className,
      )}
    >
      {avatar && <span className={cn("size-7 shrink-0 rounded-full", avatar)} />}
      <span className="flex flex-col gap-[7px]">
        {lines.map((w) => (
          <i
            key={w}
            className={cn("block h-2 rounded-full", own ? "bg-white/45" : "bg-track")}
            style={{ width: w }}
          />
        ))}
      </span>
    </span>
  );
}
