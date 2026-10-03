import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { timed } from "@/lib/perf/timing";

export interface SessionUser {
  id: string;
  email: string | null;
}

// Kept out of components/**, app/**/page.tsx and app/**/layout.tsx per the
// ESLint Supabase boundary (eslint.config.mjs) — those may only import this
// wrapper, never @/lib/supabase/* directly.
// getClaims() verifies the session JWT's signature locally (asymmetric ES256
// signing key + a cached JWKS) instead of a round trip to the Auth server on
// every render; with a symmetric HS256 key it falls back to getUser() itself,
// so it is never less safe than getUser(). The route handlers that act with
// the service role still call getUser() for the full server-side check.
// cache(): the (app) layout, the page and query modules all ask "who is
// signed in" during one request — dedupe to a single verification.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await timed("render.getClaims", supabase.auth.getClaims());
  if (error || !data?.claims?.sub) return null;
  const email = data.claims.email;
  return { id: data.claims.sub, email: typeof email === "string" ? email : null };
});
