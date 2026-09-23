"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/actions";

// Thin wrapper so client components can pass this straight to a <form
// action={...}> without also having to call redirect() themselves.
export async function signOutAndRedirect(): Promise<void> {
  await signOut();
  redirect("/");
}
