import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isDemoAvailable } from "@/lib/demo/config";
import { DEMO_COOKIE, parseDemoScenario, type DemoScenario } from "@/lib/demo/constants";

// The demo scenario of this request, or null for the real app.
export const getDemoScenario = cache(async (): Promise<DemoScenario | null> => {
  if (!isDemoAvailable()) return null;
  const store = await cookies();
  return parseDemoScenario(store.get(DEMO_COOKIE)?.value);
});
