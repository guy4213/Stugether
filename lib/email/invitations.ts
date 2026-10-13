import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { roomInvitationEmail } from "@/lib/email/templates";

// Email the invitees of a room invitation (Change Request 13.10.2026). Runs
// after the response (after()); a failure never undoes the invitation — the
// in-app notification is still there. Needs the service role: recipient
// addresses live in auth.users, which no student may read.
export async function sendRoomInvitationEmails(input: {
  roomId: string;
  inviterId: string;
  inviteeIds: string[];
  origin: string;
}): Promise<void> {
  if (input.inviteeIds.length === 0) return;
  const admin = createAdminClient();

  const [{ data: room }, { data: inviter }, { data: prefs }] = await Promise.all([
    admin.from("rooms").select("name, course_id").eq("id", input.roomId).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", input.inviterId).maybeSingle(),
    admin
      .from("notification_preferences")
      .select("user_id, email_invites")
      .in("user_id", input.inviteeIds),
  ]);
  if (!room) return;
  const { data: course } = await admin
    .from("courses")
    .select("name")
    .eq("id", room.course_id)
    .maybeSingle();

  // No preferences row = default (emails on).
  const optedOut = new Set(
    (prefs ?? []).filter((p) => p.email_invites === false).map((p) => p.user_id as string),
  );
  const email = roomInvitationEmail({
    inviterName: inviter?.full_name ?? "חבר/ת קורס",
    roomName: room.name,
    courseName: course?.name ?? null,
    url: `${input.origin}/notifications?category=invitations`,
  });

  await Promise.all(
    input.inviteeIds
      .filter((id) => !optedOut.has(id))
      .map(async (id) => {
        try {
          const { data, error } = await admin.auth.admin.getUserById(id);
          if (error) throw error;
          const to = data.user?.email;
          if (to) await sendEmail({ to, ...email });
        } catch (err) {
          Sentry.captureException(err, { extra: { room_id: input.roomId, invitee_id: id } });
        }
      }),
  );
}
