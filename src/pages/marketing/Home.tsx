import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { HeroSection } from "@/components/marketing/HeroSection";
import { CredibilityStrip } from "@/components/marketing/CredibilityStrip";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { AISpotlight } from "@/components/marketing/AISpotlight";
import { ProductShowcase } from "@/components/marketing/ProductShowcase";
import { BentoFeatures } from "@/components/marketing/BentoFeatures";
import { UKDifferentiator } from "@/components/marketing/UKDifferentiator";
import { AudiencePaths } from "@/components/marketing/AudiencePaths";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { FounderStory } from "@/components/marketing/FounderStory";
// import { TestimonialsCarousel } from "@/components/marketing/TestimonialsCarousel"; // TODO: when ready
import { StatsCounter } from "@/components/marketing/StatsCounter";
import { CTASection } from "@/components/marketing/CTASection";

export default function MarketingHome() {
  usePageMeta("LessonLoop — AI-Powered Music School Management for UK Teachers", "Scheduling, invoicing, parent portal & AI assistant built for UK music educators. Try free for 30 days.");

  return (
    <MarketingLayout>
      <HeroSection />
      <CredibilityStrip />
      <BeforeAfter />
      <AISpotlight />
      <ProductShowcase />
      <BentoFeatures />
      <UKDifferentiator />
      <AudiencePaths />
      <HowItWorks />
      <FounderStory />
      {/* <TestimonialsCarousel /> */}
      <StatsCounter />
      <CTASection />
    </MarketingLayout>
  );
}
