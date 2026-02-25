import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { HomepageSchema } from "@/components/marketing/HomepageSchema";
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
  usePageMeta(
    "LessonLoop — Music School Management Software for UK Academies",
    "Schedule lessons, automate invoicing, track attendance, and keep parents in the loop. Music school management software built for UK educators. Free 30-day trial.",
    {
      ogTitle: "LessonLoop — Music School Management Software",
      ogDescription: "Schedule lessons, automate invoicing, and keep parents in the loop. Built for UK music educators.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/",
      ogImage: "https://lessonloop.co.uk/og-home.png",
      ogLocale: "en_GB",
      ogSiteName: "LessonLoop",
      twitterCard: "summary_large_image",
      canonical: "https://lessonloop.co.uk/",
      robots: "index, follow",
    }
  );

  return (
    <MarketingLayout>
      <HomepageSchema />
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
