import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CtaBanner } from "@/components/landing/cta-banner";
import { SiteFooter } from "@/components/landing/site-footer";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "StuGether — לומדים ביחד",
};

// Landing page per Landing.dc.html. Signed-in visitors get "to dashboard"
// CTAs instead of sign-up/login.
export default async function HomePage() {
  const isAuthed = (await getCurrentUser()) !== null;

  return (
    <div className="flex flex-1 flex-col bg-background">
      <main id="main-content" className="flex flex-col">
        <HeroSection isAuthed={isAuthed} />
        <FeaturesGrid />
        <HowItWorks />
        <CtaBanner isAuthed={isAuthed} />
      </main>
      <SiteFooter />
    </div>
  );
}
