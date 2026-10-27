// ?next=/notifications?... (app/invitations/route.ts, login, the OAuth
// callback): back to where the user was headed. Same-site paths only — never
// an open redirect.
export function safeNextPath(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : null;
}
