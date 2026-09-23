import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRoom, listRoomMembers } from "@/lib/repositories/rooms";
import { listRoomMessages } from "@/lib/repositories/messages";
import { getCourse } from "@/lib/repositories/catalog";

// Returns null when the room doesn't exist OR the caller isn't an active
// member — rooms_select_member_or_admin RLS already returns null for a
// non-member's getRoom() call, so this never distinguishes "not found" from
// "no access" (same as the rest of the app's RLS-first design).
export async function getRoomPageData(roomId: string) {
  const supabase = await createClient();
  const room = await getRoom(supabase, roomId);
  if (!room) return null;

  const [members, messages, course] = await Promise.all([
    listRoomMembers(supabase, roomId),
    listRoomMessages(supabase, roomId, { limit: 50 }),
    getCourse(supabase, room.course_id),
  ]);

  // listRoomMessages orders newest-first (keyset pagination); the chat
  // window renders chronologically.
  return { room, members, messages: [...messages].reverse(), course };
}
