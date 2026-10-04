"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CheckIcon, LogOutIcon, PaletteIcon } from "lucide-react";
import { cn } from "cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { exitDemo, setDemoScenario } from "@/lib/demo/actions";
import {
  DEMO_COOKIE,
  DEMO_INFI_COURSE_ID,
  DEMO_LIVE_ROOM_ID,
  DEMO_SCENARIO_LABEL,
  DEMO_SCENARIOS,
  parseDemoScenario,
  type DemoScenario,
} from "@/lib/demo/constants";

const APP_PATHS = ["/dashboard", "/courses", "/rooms", "/notifications", "/analytics", "/profile"];

const QUICK_LINKS = [
  { href: "/dashboard", label: "בית" },
  { href: `/courses/${DEMO_INFI_COURSE_ID}`, label: "קורס אינפי 1" },
  { href: `/rooms/${DEMO_LIVE_ROOM_ID}`, label: "חדר לימוד" },
  { href: "/notifications", label: "התראות" },
];

function readCookie(): DemoScenario | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${DEMO_COOKIE}=([^;]*)`));
  return parseDemoScenario(match?.[1]);
}

const noopSubscribe = () => () => {};

// Floating button (bottom-right in RTL) for designers: enter demo mode and
// switch between its three scenarios. Rendered only where demo mode is
// available (lib/demo/config.ts).
export function DemoSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const cookieScenario = useSyncExternalStore(noopSubscribe, readCookie, () => null);
  // The cookie is read on render only; remember what this tab just chose.
  const [chosen, setChosen] = useState<DemoScenario | null | undefined>(undefined);
  const current = chosen === undefined ? cookieScenario : chosen;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(scenario: DemoScenario) {
    startTransition(async () => {
      const { ok } = await setDemoScenario(scenario);
      if (!ok) return;
      setChosen(scenario);
      const inApp = APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
      if (inApp) router.refresh();
      else router.push("/dashboard");
    });
  }

  function leave() {
    startTransition(async () => {
      await exitDemo();
      setChosen(null);
      setOpen(false);
      router.push("/");
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "fixed start-4 bottom-4 z-50 flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold shadow-[0_10px_24px_-10px_rgba(15,27,51,.55)] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          current
            ? "bg-violet text-white hover:brightness-110"
            : "border border-border bg-white text-foreground hover:bg-surface-2",
        )}
      >
        <PaletteIcon className="size-4" aria-hidden />
        {current ? `דמו · ${DEMO_SCENARIO_LABEL[current].title}` : "מצב דמו"}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={10} className="w-80 gap-3 p-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-extrabold">מצב דמו לעיצוב ובדיקות UX</h2>
          <p className="text-xs text-muted-foreground">
            נתונים לדוגמה בלבד, בלי משתמשים אמיתיים. שום פעולה לא נשמרת.
          </p>
        </div>

        <div role="radiogroup" aria-label="תרחיש" className="flex flex-col gap-2">
          {DEMO_SCENARIOS.map((scenario) => {
            const selected = current === scenario;
            return (
              <button
                key={scenario}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => choose(scenario)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-start transition-colors disabled:opacity-60",
                  selected
                    ? "border-violet bg-violet-soft"
                    : "border-border bg-white hover:border-primary-line",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-violet bg-violet text-white" : "border-switch-off",
                  )}
                >
                  {selected && <CheckIcon className="size-3" strokeWidth={3} />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    {DEMO_SCENARIO_LABEL[scenario].title}
                    {scenario === "active" && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success-ink">
                        להתחיל כאן
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {DEMO_SCENARIO_LABEL[scenario].description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {current && (
          <>
            <nav aria-label="מסכי הדמו" className="flex flex-wrap gap-1.5">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-ink-2 hover:bg-primary-soft hover:text-primary-strong"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={leave}
              disabled={pending}
              className="flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-sm font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
            >
              <LogOutIcon className="size-4" aria-hidden />
              יציאה ממצב דמו
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
