import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getShellData } from "@/lib/app/queries";
import { AppNav } from "@/components/app/app-nav";
import { PresenceHeartbeat } from "@/components/app/presence-heartbeat";

// Auth guard + shared shell for the whole (app) group. A student who has not
// finished the signup wizard is sent there first (SPEC §4.1).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { needsOnboarding, ...shell } = await getShellData(user.id);
  if (needsOnboarding) redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav {...shell} />
      <PresenceHeartbeat />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
