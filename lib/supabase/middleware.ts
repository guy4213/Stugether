import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { timed } from "@/lib/perf/timing";

// Session-refresh helper for proxy.ts (see @supabase/ssr's Next.js pattern —
// historically documented as the "middleware" helper; the Next.js file
// convention that calls this was renamed from middleware.ts to proxy.ts in
// Next.js 16, but the helper's role and shape are unchanged).
//
// Creates a Supabase server client bound to the request/response cookies and
// calls getClaims() (never a bare getSession()): an expired access token is
// refreshed against the auth server and the new cookies are written, while a
// still-valid token's signature is verified locally with the project's
// asymmetric signing key — no Auth round trip on every request.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Cookies must be written to both the request (so this same
          // pass-through sees the refreshed session) and the response
          // (so the browser receives the refreshed cookies).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and this call — it refreshes
  // an expired session (unlike reading the cookie alone, which can silently
  // serve an expired session) and verifies the JWT signature.
  await timed("proxy.getClaims", supabase.auth.getClaims());

  return response;
}
