import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

// Target of the "לצפייה בהזמנה" button in invitation emails: the invitations
// tab, through the login page (and back) when the invitee is signed out.
const TARGET = "/notifications?category=invitations";

export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const user = await getCurrentUser();
  if (user) return NextResponse.redirect(`${origin}${TARGET}`);
  return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(TARGET)}`);
}
