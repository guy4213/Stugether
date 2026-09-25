import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getShellData } from "@/lib/app/queries";
import { AppNav } from "@/components/app/app-nav";

// Auth guard + shared shell for the whole (app) group.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shell = await getShellData(user.id);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppNav {...shell} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
