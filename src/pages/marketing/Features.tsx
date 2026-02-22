import { useState, useEffect } from "react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
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
      <FeaturesHero activeCategory={activeCategory} onCategoryClick={setActiveCategory} />
      <SchedulingDeepDive />
      <BillingDeepDive />
      <PaymentPlansDeepDive />
      <PortalDeepDive />
      <AIDeepDive />
      <MakeUpDeepDive />
      <ExpandedFeaturesGrid />
      <CompetitorComparison />
      <UseCasesSection />
      <FeatureComparison />
      <SecuritySection />
      <FeatureCTA />
    </MarketingLayout>
  );
}
