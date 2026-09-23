import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Session-refresh helper for proxy.ts (see @supabase/ssr's Next.js pattern —
// historically documented as the "middleware" helper; the Next.js file
// convention that calls this was renamed from middleware.ts to proxy.ts in
// Next.js 16, but the helper's role and shape are unchanged).
//
// Creates a Supabase server client bound to the request/response cookies and
// calls getUser() (never getSession()) so an expired access token is
// actually refreshed against the auth server, not just read from a cookie.
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

  // Do not run code between createServerClient and this call — it forces a
  // token refresh check against the auth server (unlike getSession(), which
  // only reads the local cookie and can silently serve an expired session).
  await supabase.auth.getUser();

  return response;
}
