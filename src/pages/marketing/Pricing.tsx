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

const plans = [
  {
    name: "Solo Teacher",
    description: "Perfect for independent music educators building their private studio",
    monthlyPrice: 15,
    annualPrice: 150, // 2 months free
    icon: User,
    color: "teal" as const,
    popular: false,
    highlight: "Includes 14-day free trial",
    features: [
      "Up to 50 students",
      "Unlimited lessons",
      "Invoicing & payments",
      "Parent portal access",
      "Email support",
      "Practice tracking",
      "Basic reporting",
      "Calendar sync",
    ],
  },
  {
    name: "Academy",
    description: "For music schools, teaching studios, and growing teams",
    monthlyPrice: 49,
    annualPrice: 490, // 2 months free
    icon: Building2,
    color: "coral" as const,
    popular: true,
    highlight: "Everything you need to scale",
    features: [
      "Unlimited students",
      "Up to 10 teachers",
      "Multi-location support",
      "Advanced scheduling",
      "Bulk invoicing",
      "LoopAssist AI copilot",
      "Priority support",
      "Custom branding",
      "Advanced reporting",
      "Resource library",
    ],
  },
  {
    name: "Agency",
    description: "For teaching agencies and large multi-site academies",
    monthlyPrice: 99,
    annualPrice: 990, // 2 months free
    icon: Crown,
    color: "teal" as const,
    popular: false,
    highlight: "White-glove service included",
    features: [
      "Everything in Academy",
      "Unlimited teachers",
      "Teacher payroll",
      "API access",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom integrations",
      "White-label options",
      "On-site training",
      "SSO / SAML",
    ],
  },
];

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <MarketingLayout>
      {/* Hero with billing toggle */}
      <PricingHero isAnnual={isAnnual} onToggle={setIsAnnual} />

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
      <FeatureComparison />

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
