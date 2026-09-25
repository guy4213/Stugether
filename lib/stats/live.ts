// A room counts as "LIVE" while its last message is fresh.
const LIVE_WINDOW_MS = 30 * 60 * 1000;

export function isRoomLive(
  room: { status: string; last_message_at: string | null; created_at?: string },
  now = Date.now(),
): boolean {
  if (room.status !== "active") return false;
  const last = room.last_message_at ?? room.created_at ?? null;
  return !!last && now - new Date(last).getTime() < LIVE_WINDOW_MS;
}
