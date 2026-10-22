"use server";

import { createClient } from "@/lib/supabase/server";
import { touchLastSeen } from "@/lib/repositories/profiles";
import { getCurrentUser } from "@/lib/auth/session";

// Presence heartbeat from an open, visible tab (components/app/presence-heartbeat.tsx).
// The (app) layout only runs on full loads, so client navigation and a long
// stay in a room would otherwise go stale. No revalidation: nothing to re-render.
export async function heartbeatAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.demo) return;
  const supabase = await createClient();
  await touchLastSeen(supabase, user.id).catch(() => {});
}
