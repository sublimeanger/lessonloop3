import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const tiers = [
  {
    name: "Solo",
    description: "For independent teachers",
    price: "£12",
    popular: false,
  },
  {
    name: "Academy",
    description: "For music schools",
    price: "£49",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For large organizations",
    price: "Custom",
    popular: false,
  },
];

const features = [
  { name: "Unlimited students", solo: true, academy: true, enterprise: true },
  { name: "Drag & drop calendar", solo: true, academy: true, enterprise: true },
  { name: "Invoice generation", solo: true, academy: true, enterprise: true },
  { name: "Parent portal", solo: true, academy: true, enterprise: true },
  { name: "Online payments", solo: true, academy: true, enterprise: true },
  { name: "Practice tracking", solo: true, academy: true, enterprise: true },
  { name: "LoopAssist AI", solo: "Basic", academy: true, enterprise: true },
  { name: "Multiple teachers", solo: false, academy: true, enterprise: true },
  { name: "Multi-location", solo: false, academy: true, enterprise: true },
  { name: "Team permissions", solo: false, academy: true, enterprise: true },
  { name: "Payroll reports", solo: false, academy: true, enterprise: true },
  { name: "Resource library", solo: "Limited", academy: true, enterprise: true },
  { name: "Custom branding", solo: false, academy: true, enterprise: true },
  { name: "API access", solo: false, academy: false, enterprise: true },
  { name: "Dedicated support", solo: false, academy: false, enterprise: true },
  { name: "SSO / SAML", solo: false, academy: false, enterprise: true },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="w-5 h-5 text-success mx-auto" />;
  }
  if (value === false) {
    return <Minus className="w-5 h-5 text-muted-foreground/50 mx-auto" />;
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export function FeatureComparison() {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Compare Plans
          </span>
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
            Choose your plan
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
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
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-border">
              <div className="p-6">
                <p className="text-sm text-muted-foreground">Features</p>
              </div>
              {tiers.map((tier) => (
                <div
                  key={tier.name}
                  className={cn(
                    "p-6 text-center",
                    tier.popular && "bg-primary/5"
                  )}
                >
                  {tier.popular && (
                    <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium mb-3">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{tier.description}</p>
                  <p className="text-3xl font-bold text-foreground">
                    {tier.price}
                    {tier.price !== "Custom" && <span className="text-sm text-muted-foreground">/mo</span>}
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
                transition={{ delay: index * 0.02 }}
                className={cn(
                  "grid grid-cols-4 border-b border-border last:border-0",
                  index % 2 === 0 && "bg-muted/30"
                )}
              >
                <div className="p-4 flex items-center">
                  <span className="text-sm text-foreground">{feature.name}</span>
                </div>
                <div className="p-4 flex items-center justify-center">
                  <FeatureValue value={feature.solo} />
                </div>
                <div className={cn("p-4 flex items-center justify-center", "bg-primary/5")}>
                  <FeatureValue value={feature.academy} />
                </div>
                <div className="p-4 flex items-center justify-center">
                  <FeatureValue value={feature.enterprise} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-6">
          {tiers.map((tier, tierIndex) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: tierIndex * 0.1 }}
              className={cn(
                "bg-card border rounded-2xl p-6",
                tier.popular ? "border-primary" : "border-border"
              )}
            >
              {tier.popular && (
                <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium mb-3">
                  Most Popular
                </span>
              )}
              <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">{tier.description}</p>
              <p className="text-3xl font-bold text-foreground mb-6">
                {tier.price}
                {tier.price !== "Custom" && <span className="text-sm text-muted-foreground">/mo</span>}
              </p>

              <div className="space-y-3">
                {features.slice(0, 8).map((feature) => {
                  const value = tier.name === "Solo" ? feature.solo 
                    : tier.name === "Academy" ? feature.academy 
                    : feature.enterprise;
                  
                  return (
                    <div key={feature.name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{feature.name}</span>
                      <FeatureValue value={value} />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            View full pricing details
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
