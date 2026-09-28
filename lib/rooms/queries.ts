import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRoom, listRoomMembers } from "@/lib/repositories/rooms";
import { listRoomMessages } from "@/lib/repositories/messages";
import { getCourse } from "@/lib/repositories/catalog";
import { getAppSettings } from "@/lib/repositories/admin";
import {
  listEnrolledCourseStudents,
  listRoomPendingInvitations,
} from "@/lib/repositories/invitations";
import { listPublicProfiles } from "@/lib/repositories/profiles";

const PAGE_SIZE = 50;
const MAX_MEMBERS = 4;

// Returns null when the room doesn't exist OR the caller isn't an active
// member — rooms_select_member_or_admin RLS already returns null for a
// non-member's getRoom() call, so this never distinguishes "not found" from
// "no access" (same as the rest of the app's RLS-first design).
export async function getRoomPageData(roomId: string, userId: string) {
  const supabase = await createClient();
  const room = await getRoom(supabase, roomId);
  if (!room) return null;

  const [members, messages, course, settings, invitations, classmates] = await Promise.all([
    listRoomMembers(supabase, roomId),
    listRoomMessages(supabase, roomId, { limit: PAGE_SIZE }),
    getCourse(supabase, room.course_id),
    getAppSettings(supabase),
    listRoomPendingInvitations(supabase, roomId),
    listEnrolledCourseStudents(supabase, room.course_id),
  ]);

  const activeMembers = members.filter((m) => !m.left_at);
  // A super_admin can SELECT the room row but is not a member: they get the
  // metadata only (messages RLS already returns nothing to them).
  const me = activeMembers.find((m) => m.user_id === userId) ?? null;

  // Invitee names: classmates cover the usual case; anyone else is looked up.
  const knownIds = new Set(classmates.map((c) => c.id));
  const extra = await listPublicProfiles(
    supabase,
    invitations.map((i) => i.invitee_user_id).filter((id) => !knownIds.has(id)),
  );
  const nameById = new Map([...classmates, ...extra].map((p) => [p.id, p.full_name]));

  const memberIds = new Set(activeMembers.map((m) => m.user_id));
  const invitedIds = new Set(invitations.map((i) => i.invitee_user_id));
  const openSeats = MAX_MEMBERS - activeMembers.length - invitations.length;

  return {
    room,
    course,
    members,
    // listRoomMessages orders newest-first (keyset pagination); the chat
    // window renders chronologically.
    messages: [...messages].reverse(),
    hasMoreMessages: messages.length === PAGE_SIZE,
    isMember: me !== null,
    isOwner: me?.role === "owner",
    aiAvailable: room.ai_enabled && (settings?.ai_enabled ?? false),
    globalAiEnabled: settings?.ai_enabled ?? false,
    invitations: invitations.map((i) => ({
      id: i.id,
      inviteeId: i.invitee_user_id,
      inviteeName: nameById.get(i.invitee_user_id) ?? "סטודנט/ית",
      inviterId: i.inviter_id,
      expiresAt: i.expires_at,
    })),
    inviteCandidates: classmates
      .filter((c) => c.id !== userId && !memberIds.has(c.id) && !invitedIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.full_name, avatarPath: c.avatar_url }))
      .sort((a, b) => a.name.localeCompare(b.name, "he")),
    openSeats: Math.max(0, openSeats),
  };
}

export type RoomPageData = NonNullable<Awaited<ReturnType<typeof getRoomPageData>>>;
