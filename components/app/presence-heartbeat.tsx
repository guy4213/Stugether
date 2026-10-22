"use client";

import { useEffect } from "react";
import { heartbeatAction } from "@/lib/app/actions";

// "Online" = seen in the last 5 minutes (lib/ui/people.ts). While the tab is
// visible, report every 2 minutes, and right away when it comes back.
const INTERVAL_MS = 2 * 60 * 1000;

export function PresenceHeartbeat() {
  useEffect(() => {
    let last = Date.now(); // the layout render that mounted us already counted
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < INTERVAL_MS - 5_000) return;
      last = Date.now();
      heartbeatAction().catch(() => {});
    };
    const timer = window.setInterval(beat, INTERVAL_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
  return null;
}
