import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOwnProfile, touchLastSeen } from "@/lib/repositories/profiles";
import { countUnreadNotifications } from "@/lib/repositories/notifications";
import { listMyActiveRooms } from "@/lib/repositories/rooms";

const LAST_SEEN_THROTTLE_MS = 2 * 60 * 1000;

// What the (app) top nav needs on every page: who you are, the unread
// notifications badge and the "active room" shortcut. Also the presence
// heartbeat behind "online" badges (throttled to one write per 2 minutes).
export async function getShellData(userId: string) {
  const supabase = await createClient();
  const [profile, unreadNotifications, rooms] = await Promise.all([
    getOwnProfile(supabase, userId),
    countUnreadNotifications(supabase, userId),
    listMyActiveRooms(supabase, userId),
  ]);

  const lastSeen = profile?.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
  if (profile && Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
    await touchLastSeen(supabase, userId).catch(() => {});
  }

  const activeRoom = rooms.find((r) => r.status === "active") ?? null;

  return {
    userId,
    fullName: profile?.full_name ?? "",
    avatarPath: profile?.avatar_url ?? null,
    unreadNotifications,
    activeRoomId: activeRoom?.id ?? null,
  };
}

export type ShellData = Awaited<ReturnType<typeof getShellData>>;
