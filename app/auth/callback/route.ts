import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/next-path";

// GET /auth/callback — exchanges the PKCE `code` from Supabase Auth (signup
// confirmation emails, Google sign-in) for a session, then redirects to
// `next` (same-site only) or the dashboard. The (app) layout sends a student
// who hasn't finished the onboarding wizard on to /onboarding (SPEC §4.1).
//
// On failure (an expired link, Google sign-in cancelled) the login page shows
// an error from ?auth_error=1.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next")) ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?auth_error=1`);
}
