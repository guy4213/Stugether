import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";

// Server-side Storage operations that need the service role. Kept apart from
// lib/storage/index.ts, which runs in the browser.

const ROOM_FILES_BUCKET = "room-files";

// A deleted room's exercise files ("<roomId>/..."): the bucket has no FK to
// rooms and storage.objects cannot be deleted from SQL, so leave_room returns
// the paths and we remove them here. Best-effort: a failure is reported, it
// never fails the leave (the room itself is already gone).
export async function removeRoomFiles(roomId: string, paths: string[]): Promise<void> {
  const own = paths.filter((p) => p.startsWith(`${roomId}/`));
  if (own.length === 0) return;
  try {
    const { error } = await createAdminClient().storage.from(ROOM_FILES_BUCKET).remove(own);
    if (error) throw error;
  } catch (err) {
    Sentry.captureException(err, { extra: { room_id: roomId, files: own.length } });
  }
}
