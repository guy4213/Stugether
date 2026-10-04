"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PaletteIcon } from "lucide-react";
import { cn } from "cn";
import { setDemoMode } from "@/lib/demo/actions";
import { DEMO_COOKIE, DEMO_OFF } from "@/lib/demo/constants";

const APP_PATHS = ["/dashboard", "/courses", "/rooms", "/notifications", "/analytics", "/profile"];

// Demo is on unless the cookie says "off" (same rule as lib/demo/state.ts).
function readDemoOn(): boolean {
  const match = document.cookie.match(new RegExp(`(?:^|; )${DEMO_COOKIE}=([^;]*)`));
  return match?.[1] !== DEMO_OFF;
}

const noopSubscribe = () => () => {};

// Floating toggle (bottom-right in RTL): demo mode ⇄ regular mode.
export function DemoSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const cookieOn = useSyncExternalStore(noopSubscribe, readDemoOn, () => true);
  // The cookie is read on render only; remember what this tab just chose.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const on = chosen ?? cookieOn;
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    startTransition(async () => {
      await setDemoMode(next);
      setChosen(next);
      const inApp = APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
      if (next && !inApp) router.push("/dashboard");
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      disabled={pending}
      title={on ? "לחצו למעבר למצב רגיל" : "לחצו למעבר למצב דמו"}
      className={cn(
        "fixed start-4 bottom-4 z-50 flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold shadow-[0_10px_24px_-10px_rgba(15,27,51,.55)] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70",
        on
          ? "bg-violet text-white hover:brightness-110"
          : "border border-border bg-white text-foreground hover:bg-surface-2",
      )}
    >
      <PaletteIcon className="size-4" aria-hidden />
      {on ? "מצב דמו" : "מצב רגיל"}
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          on ? "bg-white/35" : "bg-switch-off",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
            on ? "start-[18px]" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}
