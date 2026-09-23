import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /auth/callback — exchanges the PKCE `code` from Supabase Auth email
// links (signup confirmation, resend, etc.) for a session, then redirects
// to "/".
//
// On failure we redirect to "/?auth_error=1" rather than a dedicated error
// page: no such page exists yet (this task builds no UI). The query param
// is a placeholder signal for a future frontend pass to read and render an
// appropriate message.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
