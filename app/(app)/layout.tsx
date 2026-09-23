import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AppNav } from "@/components/app/app-nav";

// Auth guard + shared nav for the whole (app) group (profile, dashboard,
// courses, notifications, analytics).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      {children}
    </div>
  );
}
