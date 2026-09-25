import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listPendingInvitations } from "@/lib/repositories/invitations";

export async function getNotificationsData() {
  const supabase = await createClient();
  return { invitations: await listPendingInvitations(supabase) };
}
