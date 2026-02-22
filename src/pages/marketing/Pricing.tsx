import { useState } from "react";
import { User, Building2, Crown } from "lucide-react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
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
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <MarketingLayout>
      {/* Hero with billing toggle */}
      <PricingHero isAnnual={isAnnual} onToggle={setIsAnnual} />

      {/* AI Inclusion Banner */}
      <section className="bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-primary/5 border border-primary/15 text-center">
              <span className="text-sm lg:text-base font-medium text-foreground">
                🤖 <span className="text-primary font-semibold">LoopAssist AI</span> is included on every plan — no add-on fees.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-8 lg:py-12 bg-background relative">
        <div className="container mx-auto px-6 lg:px-8">
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
