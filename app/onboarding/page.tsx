import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingClient } from "@/components/onboarding/onboarding-client";
import { getCurrentUser } from "@/lib/auth/session";
import { getOnboardingData } from "@/lib/onboarding/queries";

export const metadata: Metadata = { title: "בואו נכיר · Stugether" };

// The signup wizard (SPEC §4.1). Outside the (app) group: no top nav, and the
// (app) layout sends every student who hasn't finished it here. Demo mode
// shows a preview on the fixture catalog that saves nothing.
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getOnboardingData(user.id, user.email);
  if (!data) redirect("/login");
  if (data.onboarded) redirect("/dashboard");

  return <OnboardingClient userId={user.id} demo={!!user.demo} data={data} />;
}
