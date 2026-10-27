"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth/actions";
import { safeNextPath } from "@/lib/auth/next-path";

// "המשך עם Google" — signs in or signs up (Supabase creates the account on
// first use). signInWithGoogle redirects to Google; it returns only on error.
// Carries the page's ?next= (login from an invitation link) through Google.
export function GoogleButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    startTransition(async () => {
      const result = await signInWithGoogle(next);
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <Button
      type="button"
      variant="quiet"
      className="h-12 w-full gap-2.5 rounded-full border-[1.5px] text-base font-semibold"
      onClick={handleClick}
      disabled={isPending}
    >
      <GoogleLogo />
      {isPending ? "מעביר ל-Google..." : "המשך עם Google"}
    </Button>
  );
}

// Google's "G" mark.
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

// "או" between the email form and the Google button.
export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
      <span className="h-px flex-1 bg-border" aria-hidden />
      או
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}
