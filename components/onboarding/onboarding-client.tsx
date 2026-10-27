"use client";

import dynamic from "next/dynamic";

// The wizard renders on the client only: it restores its draft from
// sessionStorage on first render, which the server can't see (a server render
// would hydrate into a different step).
export const OnboardingClient = dynamic(
  () => import("@/components/onboarding/onboarding-wizard").then((m) => m.OnboardingWizard),
  { ssr: false, loading: () => <WizardSkeleton /> },
);

function WizardSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-brand-soft" aria-busy="true">
      <div className="mx-auto w-full max-w-xl px-4 pt-6 sm:pt-10">
        <div className="ms-14 h-12 animate-pulse rounded-xl bg-white/60" />
      </div>
      <div className="mx-auto w-full max-w-xl px-4 pt-5">
        <div className="h-[420px] animate-pulse rounded-[28px] bg-white/70" />
      </div>
    </div>
  );
}
