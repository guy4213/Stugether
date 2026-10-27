"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/next-path";

export type AuthResult = { ok: true } | { ok: false; error: string };

// Best-effort origin for email links (emailRedirectTo). There is no
// NEXT_PUBLIC_SITE_URL in .env.example, so we derive it from the incoming
// request headers instead of inventing a new env var.
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Error codes that would tell an unauthenticated caller "this email already
// has an account" if surfaced directly. signUp() treats all of these as a
// normal success instead of calling mapAuthError, so the response is the
// same whether or not the email was already registered — otherwise an
// anonymous caller could enumerate real users' emails one guess at a time.
const EMAIL_ENUMERATION_CODES = new Set([
  "user_already_exists",
  "email_exists",
  "identity_already_exists",
]);

// Maps Supabase Auth error codes to short, Hebrew-friendly messages so
// forms can render `error` directly without knowing about Supabase.
// Reference: node_modules/@supabase/auth-js/src/lib/error-codes.ts
function mapAuthError(error: unknown): string {
  const code = isAuthError(error) ? error.code : undefined;

  switch (code) {
    case "invalid_credentials":
      return "אימייל או סיסמה שגויים";
    case "email_not_confirmed":
      return "יש לאמת את כתובת האימייל לפני ההתחברות";
    // user_already_exists / email_exists / identity_already_exists are
    // deliberately NOT mapped here: signUp() intercepts them before this
    // function is called (see below) so the response can't be used to
    // enumerate which emails are already registered. Any other caller that
    // somehow hits one of these codes falls through to the generic message.
    case "user_banned":
      return "החשבון הושבת. פנו לתמיכה";
    case "weak_password":
      return "הסיסמה חלשה מדי";
    case "email_address_invalid":
    case "validation_failed":
    case "bad_json":
      return "כתובת האימייל אינה תקינה";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "יותר מדי נסיונות. נסו שוב בעוד כמה דקות";
    case "signup_disabled":
    case "email_provider_disabled":
      return "ההרשמה אינה זמינה כרגע";
    case "provider_disabled":
      return "ההתחברות עם Google אינה זמינה כרגע";
    case "same_password":
      return "הסיסמה החדשה זהה לסיסמה הקיימת";
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
      return "פג תוקף החיבור. יש להתחבר מחדש";
    default:
      return "משהו השתבש. נסו שוב";
  }
}

/**
 * signUp(email, password) — creates the auth user. No name yet: the
 * handle_new_user trigger names the profile after the email, and the
 * onboarding wizard asks for the real name (SPEC §4.1).
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    // Don't let an "email already registered" response tell an anonymous
    // caller that. Supabase itself sends no new email to an existing
    // account, so returning ok:true here matches what actually happens and
    // gives a real and a fake signup attempt an identical response.
    if (isAuthError(error) && EMAIL_ENUMERATION_CODES.has(error.code ?? "")) {
      return { ok: true };
    }
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true };
}

/** signIn(email, password) — signs in with email/password. */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true };
}

async function isGoogleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      cache: "no-store",
    });
    if (!res.ok) return true; // can't tell — let the Auth server decide
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return true;
  }
}

/**
 * signInWithGoogle(next) — signs in or signs up with Google. Redirects to
 * Google; it comes back to /auth/callback, which exchanges the PKCE code
 * (its verifier cookie is set here) and continues to `next` or the
 * dashboard — a new student goes on to the onboarding wizard from there.
 * Returns only on failure.
 */
export async function signInWithGoogle(next?: string | null): Promise<AuthResult> {
  // signInWithOAuth only builds a URL; a disabled provider would fail on the
  // Auth server's own page (raw JSON). Its public settings say up front.
  if (!(await isGoogleEnabled())) {
    return { ok: false, error: "ההתחברות עם Google אינה זמינה כרגע" };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const safeNext = safeNextPath(next);
  const callback = `${origin}/auth/callback${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback, queryParams: { prompt: "select_account" } },
  });

  if (error || !data.url) {
    return { ok: false, error: mapAuthError(error) };
  }

  redirect(data.url);
}

/** signOut() — ends the current session. */
export async function signOut(): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true };
}

/**
 * resendVerificationEmail(email) — re-sends the signup confirmation email.
 * This is the one email SPEC.md §6 (#19) allows in phase 1.
 */
export async function resendVerificationEmail(email: string): Promise<AuthResult> {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true };
}
