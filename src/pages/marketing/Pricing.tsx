import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { 
  Check, 
  ChevronRight, 
  Sparkles, 
  Building2, 
  User, 
  Crown,
  HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Solo Teacher",
    description: "Perfect for independent music educators",
    price: "£15",
    period: "/month",
    icon: User,
    color: "teal",
    popular: false,
    features: [
      "Up to 50 students",
      "Unlimited lessons",
      "Invoicing & payments",
      "Parent portal access",
      "Email support",
      "Practice tracking",
      "Basic reporting",
    ],
  },
  {
    name: "Academy",
    description: "For music schools and teaching studios",
    price: "£49",
    period: "/month",
    icon: Building2,
    color: "coral",
    popular: true,
    features: [
      "Unlimited students",
      "Up to 10 teachers",
      "Multi-location support",
      "Advanced scheduling",
      "Bulk invoicing",
      "LoopAssist AI",
      "Priority support",
      "Custom branding",
      "Advanced reporting",
    ],
  },
  {
    name: "Agency",
    description: "For teaching agencies and large academies",
    price: "£99",
    period: "/month",
    icon: Crown,
    color: "teal",
    popular: false,
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
    ],
  },
];

const faqs = [
  {
    question: "Is there a free trial?",
    answer: "Yes! All plans include a 14-day free trial with full access to all features. No credit card required.",
  },
  {
    question: "Can I change plans later?",
    answer: "Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit and debit cards via Stripe, as well as Direct Debit for annual subscriptions.",
  },
  {
    question: "Is there a discount for annual billing?",
    answer: "Yes! Annual subscriptions receive 2 months free (16% discount). Contact us for custom enterprise pricing.",
  },
];

export default function Pricing() {
  return (
    <MarketingLayout>
      {/* Header Section */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-light" />
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-teal/10 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              Pricing
            </span>
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Simple, transparent
              <br />
              <span className="text-muted-foreground">pricing</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Start free. Upgrade when you're ready. No hidden fees.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 lg:py-24 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className={cn(
                  "relative rounded-3xl border p-8 lg:p-10 transition-all duration-300",
                  plan.popular 
                    ? "border-primary bg-card shadow-xl shadow-primary/10 scale-105 z-10" 
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-coral to-coral-dark text-white text-sm font-semibold shadow-lg">
                      <Sparkles className="w-4 h-4" />
                      Most Popular
                    </div>
                  </div>
                )}

                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
                  plan.color === "teal" 
                    ? "bg-gradient-to-br from-teal to-teal-dark" 
                    : "bg-gradient-to-br from-coral to-coral-dark"
                )}>
                  <plan.icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2">
                  {plan.name}
                </h3>
                <p className="text-muted-foreground text-sm mb-6">
                  {plan.description}
                </p>

                <div className="mb-8">
                  <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>

                <Link to="/signup" className="block mb-8">
                  <Button 
                    className={cn(
                      "w-full font-semibold",
                      plan.popular && "shadow-lg shadow-primary/25"
                    )}
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                  >
                    Start Free Trial
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>

                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className={cn(
                        "w-5 h-5 flex-shrink-0 mt-0.5",
                        plan.color === "teal" ? "text-teal" : "text-coral"
                      )} />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-6">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {faqs.map((faq, index) => (
              <motion.div
                key={faq.question}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-card border border-border"
              >
                <h3 className="font-semibold text-foreground mb-3">
                  {faq.question}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {faq.answer}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
