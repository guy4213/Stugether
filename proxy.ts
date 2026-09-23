import type { NextProxy, ProxyConfig } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// NOTE: This project runs Next.js 16, where the `middleware.ts` file
// convention is deprecated in favour of `proxy.ts` (same behaviour, renamed
// file/export — see node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/proxy.md). This file intentionally replaces the
// `middleware.ts` requested in the task spec for that reason.
//
// Runs on every non-static request and keeps the Supabase session cookie
// fresh. No route protection / redirect-if-unauthenticated logic yet — no
// pages exist to protect.
export const proxy: NextProxy = async (request) => {
  return updateSession(request);
};

export const config: ProxyConfig = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - files with an extension (images, fonts, etc. served from /public)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
