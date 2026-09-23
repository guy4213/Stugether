import { redirect } from "next/navigation";
import { InvitationRow } from "@/components/notifications/invitation-row";
import { getCurrentUser } from "@/lib/auth/session";
import { getNotificationsData } from "@/lib/notifications/queries";

// Per the client's notes: "ROOMS instead of GROUPS, remove LESSONS" — the
// only notification type in the current data model is a room invitation, so
// this page shows exactly that (no separate "lessons" category to remove).
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { invitations } = await getNotificationsData();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold">התראות</h1>

      {invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין לך התראות חדשות.</p>
      ) : (
        <div className="space-y-2">
          {invitations.map((invitation) => (
            <InvitationRow key={invitation.id} invitation={invitation} />
          ))}
        </div>
      )}
    </main>
  );
}
