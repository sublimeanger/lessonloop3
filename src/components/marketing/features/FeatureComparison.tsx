import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useState } from "react";
import { PRICING_CONFIG, PLAN_ORDER, TRIAL_DAYS } from "@/lib/pricing-config";

const tiers = PLAN_ORDER.map((key) => {
  const config = PRICING_CONFIG[key];
  return {
    name: config.name,
    description: config.tagline.replace('For ', 'For ').split('.')[0],
    price: `£${config.price.monthly}`,
    popular: config.isPopular || false,
  };
});

const features = [
  { name: "Unlimited students", teacher: true, studio: true, agency: true },
  { name: "Drag & drop calendar", teacher: true, studio: true, agency: true },
  { name: "Invoice generation", teacher: true, studio: true, agency: true },
  { name: "Parent portal", teacher: true, studio: true, agency: true },
  { name: "Online payments", teacher: true, studio: true, agency: true },
  { name: "Practice tracking", teacher: true, studio: true, agency: true },
  { name: "LoopAssist AI", teacher: true, studio: true, agency: true },
  { name: "Resource library", teacher: true, studio: true, agency: true },
  { name: "Up to 5 teachers", teacher: false, studio: true, agency: false },
  { name: "Unlimited teachers", teacher: false, studio: false, agency: true },
  { name: "Multi-location", teacher: false, studio: true, agency: true },
  { name: "Team permissions", teacher: false, studio: true, agency: true },
  { name: "Payroll reports", teacher: false, studio: true, agency: true },
  { name: "Custom branding", teacher: false, studio: true, agency: true },
  { name: "Priority support", teacher: false, studio: true, agency: true },
  { name: "API access", teacher: false, studio: false, agency: true },
  { name: "Dedicated account manager", teacher: false, studio: false, agency: true },
  { name: "SSO / SAML", teacher: false, studio: false, agency: true },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="w-4 h-4 lg:w-5 lg:h-5 text-success mx-auto" />;
  }
  if (value === false) {
    return <Minus className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground/50 mx-auto" />;
  }
  return <span className="text-xs lg:text-sm text-muted-foreground">{value}</span>;
}

interface FeatureComparisonProps {
  hidePrices?: boolean;
  hideBottomCTA?: boolean;
}

export function FeatureComparison({ hidePrices = false, hideBottomCTA = false }: FeatureComparisonProps) {
  const [showAllMobile, setShowAllMobile] = useState(false);

  return (
    <section className="py-16 lg:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 lg:mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs lg:text-sm font-semibold mb-4">
            Compare plans
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-3 lg:mb-4">
            Choose your plan
          </h2>
          <p className="text-sm lg:text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with a {TRIAL_DAYS}-day free trial. Cancel anytime.
          </p>
        </motion.div>

        {/* Desktop table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="hidden lg:block"
        >
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header - Sticky */}
            <div className="grid grid-cols-4 border-b border-border sticky top-0 bg-card z-10">
              <div className="p-4 lg:p-6">
                <p className="text-sm text-muted-foreground">Features</p>
              </div>
              {tiers.map((tier) => (
                <div
                  key={tier.name}
                  className={cn(
                    "p-4 lg:p-6 text-center",
                    tier.popular && "bg-primary/5"
                  )}
                >
                  {tier.popular && (
                    <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium mb-2 lg:mb-3">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg lg:text-xl font-bold text-foreground">{tier.name}</h3>
                  <p className="text-xs lg:text-sm text-muted-foreground mb-2">{tier.description}</p>
                  {!hidePrices && (
                    <p className="text-2xl lg:text-3xl font-bold text-foreground">
                      {tier.price}
                      {tier.price !== "Custom" && <span className="text-xs lg:text-sm text-muted-foreground">/mo</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Features */}
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(index * 0.02, 0.3) }}
                className={cn(
                  "grid grid-cols-4 border-b border-border last:border-0",
                  index % 2 === 0 && "bg-muted/30"
                )}
              >
                <div className="p-3 lg:p-4 flex items-center">
                  <span className="text-xs lg:text-sm text-foreground">{feature.name}</span>
                </div>
                <div className="p-3 lg:p-4 flex items-center justify-center">
                  <FeatureValue value={feature.teacher} />
                </div>
                <div className={cn("p-3 lg:p-4 flex items-center justify-center", "bg-primary/5")}>
                  <FeatureValue value={feature.studio} />
                </div>
                <div className="p-3 lg:p-4 flex items-center justify-center">
                  <FeatureValue value={feature.agency} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-4">
          {tiers.map((tier, tierIndex) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: tierIndex * 0.1 }}
              className={cn(
                "bg-card border rounded-xl p-4 sm:p-5",
                tier.popular ? "border-primary ring-1 ring-primary/20" : "border-border"
              )}
            >
              {tier.popular && (
                <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium mb-3">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
              <p className="text-xs text-muted-foreground mb-2">{tier.description}</p>
              <p className="text-2xl font-bold text-foreground mb-4">
                {!hidePrices && (
                  <>
                    {tier.price}
                    {tier.price !== "Custom" && <span className="text-xs text-muted-foreground">/mo</span>}
                  </>
                )}
              </p>

              <div className="space-y-2">
                {(showAllMobile ? features : features.slice(0, 8)).map((feature) => {
                  const value = tier.name === "Teacher" ? feature.teacher 
                    : tier.name === "Studio" ? feature.studio 
                    : feature.agency;
                  
                  return (
                    <div key={feature.name} className="flex items-center justify-between text-xs sm:text-sm py-1">
                      <span className="text-muted-foreground">{feature.name}</span>
                      <FeatureValue value={value} />
                    </div>
                  );
                })}
              </div>

              {!showAllMobile && features.length > 8 && (
                <button
                  onClick={() => setShowAllMobile(true)}
                  className="w-full mt-4 py-2 text-xs text-primary font-medium hover:underline"
                >
                  Show all {features.length} features
                </button>
              )}
            </motion.div>
          ))}
          
          {showAllMobile && (
            <button
              onClick={() => setShowAllMobile(false)}
              className="w-full py-2 text-xs text-muted-foreground font-medium hover:underline"
            >
              Show less
            </button>
          )}
        </div>

        {!hideBottomCTA && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-8 lg:mt-12"
          >
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 lg:px-6 lg:py-3 rounded-xl bg-primary text-primary-foreground text-sm lg:text-base font-medium hover:bg-primary/90 transition-colors"
            >
              View full pricing details
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
