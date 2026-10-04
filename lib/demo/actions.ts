"use server";

import { cookies } from "next/headers";
import { DEMO_COOKIE, DEMO_OFF } from "@/lib/demo/constants";

// Not httpOnly: the toggle button reads it to show the current mode.
// It carries no identity — only demo on/off.
export async function setDemoMode(on: boolean): Promise<void> {
  const store = await cookies();
  store.set(DEMO_COOKIE, on ? "active" : DEMO_OFF, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
