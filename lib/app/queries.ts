import "server-only";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { touchLastSeen } from "@/lib/repositories/profiles";
import { timed } from "@/lib/perf/timing";
import {
  getCachedMyActiveRooms,
  getCachedOwnProfile,
  getCachedUnreadNotificationCount,
} from "@/lib/app/cached";

const LAST_SEEN_THROTTLE_MS = 2 * 60 * 1000;

// What the (app) top nav needs on every page: who you are, the unread
// notifications badge and the "active room" shortcut. Also the presence
// heartbeat behind "online" badges (throttled to one write per 2 minutes).
export async function getShellData(userId: string) {
  const [profile, unreadNotifications, rooms] = await timed(
    "layout.shell",
    Promise.all([
      getCachedOwnProfile(userId),
      getCachedUnreadNotificationCount(userId),
      getCachedMyActiveRooms(userId),
    ]),
  );

  const lastSeen = profile?.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0;
  if (profile && Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
    // The heartbeat write must not delay the page: run it after the response.
    // The client is built now — cookies() is not readable inside after().
    const supabase = await createClient();
    after(() => touchLastSeen(supabase, userId).catch(() => {}));
  }

  const activeRoom = rooms.find((r) => r.status === "active") ?? null;

  return {
    userId,
    fullName: profile?.full_name ?? "",
    avatarPath: profile?.avatar_url ?? null,
    unreadNotifications,
    activeRoomId: activeRoom?.id ?? null,
    isSuperAdmin: profile?.role === "super_admin" && profile.is_active,
  };
}

export type ShellData = Awaited<ReturnType<typeof getShellData>>;
