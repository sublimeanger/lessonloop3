import { useState, useEffect } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { FeaturesSchema } from "@/components/marketing/features/FeaturesSchema";
import { FeaturesHero } from "@/components/marketing/features/FeaturesHero";
import { SchedulingDeepDive } from "@/components/marketing/features/SchedulingDeepDive";
import { BillingDeepDive } from "@/components/marketing/features/BillingDeepDive";
import { PaymentPlansDeepDive } from "@/components/marketing/features/PaymentPlansDeepDive";
import { PortalDeepDive } from "@/components/marketing/features/PortalDeepDive";
import { AIDeepDive } from "@/components/marketing/features/AIDeepDive";
import { MakeUpDeepDive } from "@/components/marketing/features/MakeUpDeepDive";
import { ExpandedFeaturesGrid } from "@/components/marketing/features/ExpandedFeaturesGrid";
import { CompetitorComparison } from "@/components/marketing/features/CompetitorComparison";
import { UseCasesSection } from "@/components/marketing/features/UseCasesSection";
import { FeatureComparison } from "@/components/marketing/features/FeatureComparison";
import { SecuritySection } from "@/components/marketing/features/SecuritySection";
import { FeatureCTA } from "@/components/marketing/features/FeatureCTA";

export default function Features() {
  usePageMeta(
    "Features — Scheduling, Billing, Parent Portal & AI | LessonLoop",
    "Explore LessonLoop's complete feature set: drag-and-drop scheduling, automated invoicing, parent portal, practice tracking, LoopAssist AI, and more. Built for UK music schools.",
    {
      ogTitle: "Features — LessonLoop Music School Software",
      ogDescription: "Drag-and-drop scheduling, automated invoicing, parent portal, AI assistant, and 50+ features built for UK music schools.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/features",
      ogImage: "https://lessonloop.co.uk/og-features.png",
      ogLocale: "en_GB",
      ogSiteName: "LessonLoop",
      twitterCard: "summary_large_image",
      canonical: "https://lessonloop.co.uk/features",
      robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    }
  );
  const [activeCategory, setActiveCategory] = useState("scheduling");

  // Update active category based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["scheduling", "billing", "portal", "ai", "makeups", "more"];
      
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActiveCategory(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <MarketingLayout>
      <FeaturesSchema />
      <FeaturesHero activeCategory={activeCategory} onCategoryClick={setActiveCategory} />
      <SchedulingDeepDive />
      <BillingDeepDive />
      <PaymentPlansDeepDive />
      <PortalDeepDive />
      <AIDeepDive />
      <MakeUpDeepDive />
      <ExpandedFeaturesGrid />
      <UseCasesSection />
      <FeatureComparison />
      <CompetitorComparison />
      <SecuritySection />
      <FeatureCTA />
    </MarketingLayout>
  );
}
