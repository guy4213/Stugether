import "server-only";

// Where demo mode may be switched on at all. Off on production by default;
// on for local dev and Vercel preview deployments. DEMO_MODE=on|off overrides
// (e.g. DEMO_MODE=on on a dedicated design deployment). Without this gate the
// demo cookie is ignored everywhere.
export function isDemoAvailable(): boolean {
  const flag = process.env.DEMO_MODE?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
}
