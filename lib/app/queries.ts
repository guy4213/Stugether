import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/repositories/profiles";
import { listPendingInvitations } from "@/lib/repositories/invitations";

// What the (app) sidebar needs on every page: who you are + an unread-ish
// badge for notifications.
export async function getShellData(userId: string) {
  const supabase = await createClient();
  const [profile, invitations] = await Promise.all([
    getOwnProfile(supabase, userId),
    listPendingInvitations(supabase),
  ]);
  return {
    fullName: profile?.full_name ?? "",
    avatarPath: profile?.avatar_url ?? null,
    pendingInvitations: invitations.length,
  };
}
