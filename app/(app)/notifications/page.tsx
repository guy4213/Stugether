import { redirect } from "next/navigation";
import { BellOffIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvitationRow } from "@/components/notifications/invitation-row";
import { getCurrentUser } from "@/lib/auth/session";
import { getNotificationsData } from "@/lib/notifications/queries";

// Per the client's notes: "ROOMS instead of GROUPS, remove LESSONS" — the
// only notification type in the data model is a room invitation.
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { invitations } = await getNotificationsData();

  return (
    <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">התראות</h1>
        <p className="mt-1 text-muted-foreground">הזמנות לחדרי לימוד שממתינות לתשובה שלך</p>
      </div>

      <Card className="border-0 shadow-sm ring-0">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            הזמנות לחדרים
            {invitations.length > 0 && (
              <span className="ms-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {invitations.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <BellOffIcon className="size-10 opacity-40" />
              <p>אין התראות חדשות. כשיזמינו אותך לחדר לימוד — זה יופיע כאן.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <InvitationRow key={invitation.id} invitation={invitation} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
