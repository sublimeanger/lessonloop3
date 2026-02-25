import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { UKSchema } from "@/components/marketing/uk/UKSchema";
import { UKHero } from "@/components/marketing/uk/UKHero";
import { UKProblemStatement } from "@/components/marketing/uk/UKProblemStatement";
import { UKSolution } from "@/components/marketing/uk/UKSolution";
import { UKCompetitorContrast } from "@/components/marketing/uk/UKCompetitorContrast";
import { UKGDPRDeepDive } from "@/components/marketing/uk/UKGDPRDeepDive";
import { UKFounderStory } from "@/components/marketing/uk/UKFounderStory";
import { UKPricing } from "@/components/marketing/uk/UKPricing";
import { UKFinalCTA } from "@/components/marketing/uk/UKFinalCTA";

export default function UK() {
  usePageMeta(
    "Music School Software Built for the UK — GDPR, GBP & Termly Billing | LessonLoop",
    "The only music school management software built natively for UK educators. GBP billing, UK VAT, termly scheduling, GDPR compliance, and British English throughout. Free 30-day trial.",
    {
      ogTitle: "Music School Software Built for the UK | LessonLoop",
      ogDescription: "GBP billing, UK VAT, termly scheduling, GDPR compliance, and an AI assistant. The only music school software built natively for UK educators.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/uk",
      ogImage: "https://lessonloop.co.uk/og-uk.png",
      ogLocale: "en_GB",
      ogSiteName: "LessonLoop",
      twitterCard: "summary_large_image",
      canonical: "https://lessonloop.co.uk/uk",
      robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    }
  );

  return (
    <MarketingLayout>
      <UKSchema />
      <UKHero />
      <UKProblemStatement />
      <UKSolution />
      <UKCompetitorContrast />
      <UKGDPRDeepDive />
      <UKFounderStory />
      <UKPricing />
      <UKFinalCTA />
    </MarketingLayout>
  );
}
