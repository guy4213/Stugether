import { SiteNav } from "@/components/landing/site-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesRow, SiteFooter } from "@/components/landing/features-row";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteNav />
      <main id="main-content" className="flex flex-1 flex-col">
        <HeroSection />
        <FeaturesRow />
      </main>
      <SiteFooter />
    </div>
  );
}
