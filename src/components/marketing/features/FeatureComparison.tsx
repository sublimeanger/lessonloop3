import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useState } from "react";

const tiers = [
  {
    name: "Solo",
    description: "For independent teachers",
    price: "£15",
    popular: false,
  },
  {
    name: "Academy",
    description: "For music schools",
    price: "£49",
    popular: true,
  },
  {
    name: "Agency",
    description: "For teaching agencies",
    price: "£99",
    popular: false,
  },
];

const features = [
  { name: "Up to 50 students", solo: true, academy: false, agency: false },
  { name: "Unlimited students", solo: false, academy: true, agency: true },
  { name: "Drag & drop calendar", solo: true, academy: true, agency: true },
  { name: "Invoice generation", solo: true, academy: true, agency: true },
  { name: "Parent portal", solo: true, academy: true, agency: true },
  { name: "Online payments", solo: true, academy: true, agency: true },
  { name: "Practice tracking", solo: true, academy: true, agency: true },
  { name: "LoopAssist AI", solo: false, academy: true, agency: true },
  { name: "Up to 10 teachers", solo: false, academy: true, agency: false },
  { name: "Unlimited teachers", solo: false, academy: false, agency: true },
  { name: "Multi-location", solo: false, academy: true, agency: true },
  { name: "Team permissions", solo: false, academy: true, agency: true },
  { name: "Payroll reports", solo: false, academy: true, agency: true },
  { name: "Resource library", solo: false, academy: true, agency: true },
  { name: "Custom branding", solo: false, academy: true, agency: true },
  { name: "API access", solo: false, academy: false, agency: true },
  { name: "Dedicated account manager", solo: false, academy: false, agency: true },
  { name: "SSO / SAML", solo: false, academy: false, agency: true },
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

export function FeatureComparison() {
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
            Compare Plans
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-3 lg:mb-4">
            Choose your plan
          </h2>
          <p className="text-sm lg:text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required.
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
                  <p className="text-2xl lg:text-3xl font-bold text-foreground">
                    {tier.price}
                    {tier.price !== "Custom" && <span className="text-xs lg:text-sm text-muted-foreground">/mo</span>}
                  </p>
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
                  <FeatureValue value={feature.solo} />
                </div>
                <div className={cn("p-3 lg:p-4 flex items-center justify-center", "bg-primary/5")}>
                  <FeatureValue value={feature.academy} />
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
                {tier.price}
                {tier.price !== "Custom" && <span className="text-xs text-muted-foreground">/mo</span>}
              </p>

              <div className="space-y-2">
                {(showAllMobile ? features : features.slice(0, 8)).map((feature) => {
                  const value = tier.name === "Solo" ? feature.solo 
                    : tier.name === "Academy" ? feature.academy 
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

        {/* CTA */}
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
      </div>
    </section>
  );
}
