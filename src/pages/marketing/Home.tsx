import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { HeroSection } from "@/components/marketing/HeroSection";
import { LogoMarquee } from "@/components/marketing/LogoMarquee";
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
      <LogoMarquee />
      <BentoFeatures />
      <ProductShowcase />
      <HowItWorks />
      <StatsCounter />
      <TestimonialsSection />
      <CTASection />
    </MarketingLayout>
  );
}
