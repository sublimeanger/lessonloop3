import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { HeroSection } from "@/components/marketing/HeroSection";
import { SocialProofStrip } from "@/components/marketing/SocialProofStrip";
import { BeforeAfter } from "@/components/marketing/BeforeAfter";
import { AISpotlight } from "@/components/marketing/AISpotlight";
import { ProductShowcase } from "@/components/marketing/ProductShowcase";
import { UKDifferentiator } from "@/components/marketing/UKDifferentiator";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { FounderStory } from "@/components/marketing/FounderStory";
import { CTASection } from "@/components/marketing/CTASection";

export default function MarketingHome() {
  usePageMeta("LessonLoop — AI-Powered Music School Management for UK Teachers", "Scheduling, invoicing, parent portal & AI assistant built for UK music educators. Try free for 30 days.");

  return (
    <MarketingLayout>
      <HeroSection />
      <SocialProofStrip />
      <BeforeAfter />
      <ProductShowcase />
      <AISpotlight />
      <UKDifferentiator />
      <HowItWorks />
      <FounderStory />
      <CTASection />
    </MarketingLayout>
  );
}
