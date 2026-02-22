import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { HeroSection } from "@/components/marketing/HeroSection";
import { CredibilityStrip } from "@/components/marketing/CredibilityStrip";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { BentoFeatures } from "@/components/marketing/BentoFeatures";
import { ProductShowcase } from "@/components/marketing/ProductShowcase";
import { AISpotlight } from "@/components/marketing/AISpotlight";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { UKDifferentiator } from "@/components/marketing/UKDifferentiator";
import { StatsCounter } from "@/components/marketing/StatsCounter";
import { AudiencePaths } from "@/components/marketing/AudiencePaths";
import { FounderStory } from "@/components/marketing/FounderStory";
import { CTASection } from "@/components/marketing/CTASection";

export default function MarketingHome() {
  return (
    <MarketingLayout>
      <HeroSection />
      <CredibilityStrip />
      <BeforeAfter />
      <BentoFeatures />
      <ProductShowcase />
      <AISpotlight />
      <HowItWorks />
      <UKDifferentiator />
      <StatsCounter />
      <AudiencePaths />
      <FounderStory />
      <CTASection />
    </MarketingLayout>
  );
}
