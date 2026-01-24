import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { HeroSection } from "@/components/marketing/HeroSection";
import { LogoCloud } from "@/components/marketing/LogoCloud";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { TestimonialsSection } from "@/components/marketing/TestimonialsSection";
import { CTASection } from "@/components/marketing/CTASection";

export default function MarketingHome() {
  return (
    <MarketingLayout>
      <HeroSection />
      <LogoCloud />
      <FeaturesSection />
      <TestimonialsSection />
      <CTASection />
    </MarketingLayout>
  );
}
