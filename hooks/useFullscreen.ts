"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

// "מסך מלא" in the study room (client QA 12.11.2026). The real Fullscreen API
// where the browser has it; on iPhone Safari (no element fullscreen) a CSS
// "pseudo fullscreen": the caller pins the element over the page while
// `pseudo` is true. Leaving the room (unmount: back arrow, Back, a link,
// leaving or deleting the room) always returns to the normal screen.
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);

  useEffect(() => {
    const onChange = () => setNative(document.fullscreenElement === ref.current && !!ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  // Esc leaves the pseudo mode too.
  useEffect(() => {
    if (!pseudo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPseudo(false);
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [pseudo]);

  // Unmount = leaving the room: back to the normal screen.
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    },
    [],
  );

  const enter = useCallback(() => {
    const el = ref.current;
    if (el?.requestFullscreen && document.fullscreenEnabled) {
      el.requestFullscreen().catch(() => setPseudo(true));
    } else {
      setPseudo(true);
    }
  }, [ref]);

  const exit = useCallback(() => {
    setPseudo(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const active = native || pseudo;
  return { active, pseudo, enter, exit, toggle: active ? exit : enter };
}
