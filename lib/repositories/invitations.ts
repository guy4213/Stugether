import type { SupabaseClient } from "@supabase/supabase-js";
import { listPublicProfiles, type PublicProfile } from "./profiles";

export interface RoomInvitation {
  id: string;
  room_id: string;
  inviter_id: string;
  invitee_user_id: string;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  expires_at: string;
  responded_at: string | null;
  created_at: string;
}

export interface PendingInvitation {
  id: string;
  room_id: string;
  room_name: string;
  room_topic: string | null;
  course_id: string;
  course_name: string;
  course_code: string | null;
  inviter_id: string;
  inviter_name: string;
  inviter_avatar_url: string | null;
  expires_at: string;
  created_at: string;
}

// Wraps accept_room_invitation(p_invitation_id). Returns the room id on
// success, or null — null ALWAYS means INVITATION_EXPIRED (the RPC never
// raises that as an exception; see the migration's comment). Other failures
// (INVITATION_NOT_FOUND, INVITATION_NOT_PENDING, ROOM_NOT_ACTIVE, ROOM_FULL)
// surface as thrown Postgres errors whose message is the error code.
export async function acceptInvitation(
  client: SupabaseClient,
  invitationId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc("accept_room_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
  return data as string | null;
}

// Wraps decline_room_invitation(p_invitation_id): invitee only, pending only.
export async function declineInvitation(
  client: SupabaseClient,
  invitationId: string,
): Promise<void> {
  const { error } = await client.rpc("decline_room_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}

// Wraps revoke_room_invitation(p_invitation_id): inviter only, pending only.
export async function revokeInvitation(
  client: SupabaseClient,
  invitationId: string,
): Promise<void> {
  const { error } = await client.rpc("revoke_room_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}

// Wraps get_pending_invitations() — already filtered to the caller.
export async function listPendingInvitations(
  client: SupabaseClient,
): Promise<PendingInvitation[]> {
  const { data, error } = await client.rpc("get_pending_invitations");
  if (error) throw error;
  return data as PendingInvitation[];
}

// Plain INSERT into room_invitations. All validation (same-course enrollment,
// room capacity, not-self, not-already-a-member, etc.) is done by the
// room_invitations_insert_member RLS policy / can_invite_to_room() helper —
// this function does not duplicate that logic. An invalid invitation is
// rejected by Postgres and the error propagates to the caller.
export async function createInvitation(
  client: SupabaseClient,
  input: { roomId: string; inviterId: string; inviteeUserId: string },
): Promise<RoomInvitation> {
  const { data, error } = await client
    .from("room_invitations")
    .insert({
      room_id: input.roomId,
      inviter_id: input.inviterId,
      invitee_user_id: input.inviteeUserId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as RoomInvitation;
}

// Students actively enrolled in a course, for the invitee picker. Two queries
// (enrollments, then a batched public_profiles lookup) since public_profiles
// is a view with no FK for PostgREST to auto-embed through.
export async function listEnrolledCourseStudents(
  client: SupabaseClient,
  courseId: string,
): Promise<PublicProfile[]> {
  const { data, error } = await client
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId)
    .eq("status", "active");
  if (error) throw error;

  const userIds = (data as { user_id: string }[]).map((row) => row.user_id);
  return listPublicProfiles(client, userIds);
}
