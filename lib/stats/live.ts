// A room counts as "LIVE" while its last message is fresh, or while one of
// its members (other than the viewer) is online — so a room opened a while
// ago with nobody typing yet still shows under "פעילים עכשיו" (client QA
// 12.11.2026, migration 20261112000001).
const LIVE_WINDOW_MS = 30 * 60 * 1000;

export function isRoomLive(
  room: { status: string; last_message_at: string | null; created_at?: string },
  now = Date.now(),
  onlineOthers = 0,
): boolean {
  if (room.status !== "active") return false;
  if (onlineOthers > 0) return true;
  const last = room.last_message_at ?? room.created_at ?? null;
  return !!last && now - new Date(last).getTime() < LIVE_WINDOW_MS;
}
