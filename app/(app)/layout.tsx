import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Auth guard for the whole (app) group (profile now, dashboard/courses later).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}
