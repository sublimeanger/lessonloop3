import { useState } from "react";
import { User, Building2, Crown, Sparkles } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { PricingSchema } from "@/components/marketing/pricing/PricingSchema";
import { PricingHero } from "@/components/marketing/pricing/PricingHero";
import { PricingCard } from "@/components/marketing/pricing/PricingCard";
import { PricingProof } from "@/components/marketing/pricing/PricingProof";
import { FeatureComparison } from "@/components/marketing/features/FeatureComparison";
import { ValueCalculator } from "@/components/marketing/pricing/ValueCalculator";
import { PricingFAQ } from "@/components/marketing/pricing/PricingFAQ";
import { EnterpriseCTA } from "@/components/marketing/pricing/EnterpriseCTA";
import { FinalCTA } from "@/components/marketing/pricing/FinalCTA";
import { PRICING_CONFIG, PLAN_ORDER, type PlanKey, TRIAL_DAYS } from "@/lib/pricing-config";

const PLAN_ICONS: Record<PlanKey, typeof User> = {
  teacher: User,
  studio: Building2,
  agency: Crown,
};

const PLAN_COLORS: Record<PlanKey, "teal" | "coral"> = {
  teacher: "teal",
  studio: "coral",
  agency: "teal",
};

const PLAN_HIGHLIGHTS: Record<PlanKey, string> = {
  teacher: `Includes ${TRIAL_DAYS}-day free trial`,
  studio: "Everything you need to scale",
  agency: "White-glove service included",
};

const plans = PLAN_ORDER.map((key) => {
  const config = PRICING_CONFIG[key];
  return {
    name: config.name,
    description: config.tagline,
    monthlyPrice: config.price.monthly,
    annualPrice: config.price.yearly,
    icon: PLAN_ICONS[key],
    color: PLAN_COLORS[key],
    popular: config.isPopular || false,
    highlight: PLAN_HIGHLIGHTS[key],
    features: config.marketingFeatures,
  };
});

export default function Pricing() {
  usePageMeta(
    "Pricing — Plans for Solo Teachers to Academies | LessonLoop",
    "From £12/month for solo teachers to custom enterprise plans. All plans include LoopAssist AI, parent portal, and a 30-day free trial. No credit card required. Built for UK music schools.",
    {
      ogTitle: "Pricing — LessonLoop Music School Software",
      ogDescription: "From £12/month for solo teachers to custom enterprise plans. LoopAssist AI included on every plan. 30-day free trial, no credit card required.",
      ogType: "website",
      ogUrl: "https://lessonloop.co.uk/pricing",
      ogImage: "https://lessonloop.co.uk/og-pricing.png",
      ogLocale: "en_GB",
      ogSiteName: "LessonLoop",
      twitterCard: "summary_large_image",
      canonical: "https://lessonloop.co.uk/pricing",
      robots: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    }
  );
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <MarketingLayout>
      <PricingSchema />
      {/* Hero with billing toggle */}
      <PricingHero isAnnual={isAnnual} onToggle={setIsAnnual} />

      {/* AI Inclusion Banner */}
      <section className="bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="max-w-6xl mx-auto text-center py-4">
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
              <Sparkles className="w-4 h-4 text-primary" />
              LoopAssist AI is included on every plan — no add-on fees
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-8 lg:py-12 bg-background relative">
        <div className="container mx-auto px-6 lg:px-8 overflow-hidden">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <PricingCard 
                key={plan.name} 
                plan={plan} 
                isAnnual={isAnnual}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <PricingProof />

      {/* Feature Comparison Table */}
      <FeatureComparison hidePrices hideBottomCTA />

      {/* Value Calculator */}
      <ValueCalculator />

      {/* FAQ Section */}
      <PricingFAQ />

      {/* Enterprise CTA */}
      <EnterpriseCTA />

      {/* Final CTA */}
      <FinalCTA />
    </MarketingLayout>
  );
}
