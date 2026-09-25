"use server";

import { signUp, type AuthResult } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";

export type SignUpResult = AuthResult & { hasSession?: boolean };

// signUp() itself never tells the caller whether email confirmation is
// required (it can't — that's a project-level GoTrue setting, and its own
// email-enumeration protection deliberately returns ok:true either way). This
// checks afterwards whether a session actually got established (local dev has
// enable_confirmations = false, so it does) so the signup page can either
// redirect straight in or show a "check your email" message.
export async function signUpAndCheckSession(
  email: string,
  password: string,
  fullName: string,
): Promise<SignUpResult> {
  const result = await signUp(email, password, fullName);
  if (!result.ok) return result;

  const user = await getCurrentUser();
  return { ok: true, hasSession: !!user };
}
