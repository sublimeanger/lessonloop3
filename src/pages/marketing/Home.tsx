import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { HeroSection } from "@/components/marketing/HeroSection";
import { CredibilityStrip } from "@/components/marketing/CredibilityStrip";
import { BentoFeatures } from "@/components/marketing/BentoFeatures";
import { ProductShowcase } from "@/components/marketing/ProductShowcase";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { StatsCounter } from "@/components/marketing/StatsCounter";
import { TestimonialsSection } from "@/components/marketing/TestimonialsSection";
import { CTASection } from "@/components/marketing/CTASection";

export default function MarketingHome() {
  return (
    <MarketingLayout>
      <HeroSection />
      <CredibilityStrip />
      <BentoFeatures />
      <ProductShowcase />
      <HowItWorks />
      <StatsCounter />
      <TestimonialsSection />
      <CTASection />
    </MarketingLayout>
  );
}
