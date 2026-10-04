"use server";

import { cookies } from "next/headers";
import { isDemoAvailable } from "@/lib/demo/config";
import { DEMO_COOKIE, parseDemoScenario } from "@/lib/demo/constants";

// Not httpOnly: the floating switcher reads it to show the current scenario.
// It carries no identity — only which fixture set to render.
export async function setDemoScenario(value: string): Promise<{ ok: boolean }> {
  const scenario = parseDemoScenario(value);
  if (!isDemoAvailable() || !scenario) return { ok: false };
  const store = await cookies();
  store.set(DEMO_COOKIE, scenario, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true };
}

export async function exitDemo(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
}
