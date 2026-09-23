import { SiteNav } from "@/components/landing/site-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { StatsRow } from "@/components/landing/stats-row";
import { FeaturesRow } from "@/components/landing/features-row";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <SiteNav />
      <HeroSection />
      <StatsRow />
      <FeaturesRow />
    </main>
  );
}
