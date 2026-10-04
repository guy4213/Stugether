import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEMO_COOKIE, DEMO_OFF, parseDemoScenario, type DemoScenario } from "@/lib/demo/constants";

// The demo scenario of this request, or null for the real app. Default: demo.
export const getDemoScenario = cache(async (): Promise<DemoScenario | null> => {
  const store = await cookies();
  const value = store.get(DEMO_COOKIE)?.value;
  if (value === DEMO_OFF) return null;
  return parseDemoScenario(value) ?? "active";
});
