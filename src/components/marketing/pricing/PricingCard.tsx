import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Plan {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  icon: LucideIcon;
  color: "teal" | "coral";
  popular: boolean;
  features: string[];
  highlight?: string;
}

interface PricingCardProps {
  plan: Plan;
  isAnnual: boolean;
  index: number;
}

export function PricingCard({ plan, isAnnual, index }: PricingCardProps) {
  const currentPrice = isAnnual ? plan.annualPrice : plan.monthlyPrice;
  const monthlyEquivalent = isAnnual ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -5 }}
      className={cn(
        "relative rounded-3xl border p-8 lg:p-10 transition-all duration-500 group",
        plan.popular 
          ? "border-primary/50 bg-gradient-to-b from-card via-card to-primary/5 shadow-2xl shadow-primary/10 lg:scale-105 z-10" 
          : "border-border bg-card hover:border-primary/30 hover:shadow-xl"
      )}
    >
      {/* Animated gradient border for popular */}
      {plan.popular && (
        <div className="absolute inset-0 rounded-3xl overflow-hidden">
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{
              background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--coral)), hsl(var(--teal)), hsl(var(--primary)))",
              backgroundSize: "300% 100%",
            }}
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
          <div className="absolute inset-[1px] rounded-3xl bg-card" />
        </div>
      )}

      {/* Popular badge */}
      {plan.popular && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute -top-4 left-1/2 -translate-x-1/2"
        >
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-coral to-coral-dark text-white text-sm font-semibold shadow-lg shadow-coral/25">
            <Sparkles className="w-4 h-4" />
            Most Popular
          </div>
        </motion.div>
      )}

      <div className="relative">
        {/* Icon */}
        <motion.div 
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110",
            plan.color === "teal" 
              ? "bg-gradient-to-br from-teal to-teal-dark shadow-lg shadow-teal/25" 
              : "bg-gradient-to-br from-coral to-coral-dark shadow-lg shadow-coral/25"
          )}
        >
          <plan.icon className="w-7 h-7 text-white" />
        </motion.div>

        {/* Plan name and description */}
        <h3 className="text-2xl font-bold text-foreground mb-2">
          {plan.name}
        </h3>
        <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">
          {plan.description}
        </p>

        {/* Price */}
        <div className="mb-8">
          <div className="flex items-baseline gap-2">
            <motion.span 
              key={currentPrice}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold text-foreground"
            >
              £{monthlyEquivalent}
            </motion.span>
            <span className="text-muted-foreground">/month</span>
          </div>
          
          {isAnnual && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 mt-2"
            >
              <span className="text-sm text-muted-foreground line-through">
                £{plan.monthlyPrice}/mo
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">
                Save £{(plan.monthlyPrice - monthlyEquivalent) * 12}/year
              </span>
            </motion.div>
          )}
          
          {isAnnual && (
            <p className="text-xs text-muted-foreground mt-2">
              Billed annually (£{currentPrice}/year)
            </p>
          )}
        </div>

        {/* CTA Button */}
        <Link to="/signup" className="block mb-8">
          <Button 
            className={cn(
              "w-full font-semibold h-12 text-base transition-all duration-300",
              plan.popular 
                ? "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30" 
                : "hover:bg-primary hover:text-primary-foreground"
            )}
            variant={plan.popular ? "default" : "outline"}
            size="lg"
          >
            Start Free Trial
            <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </Button>
        </Link>

        {/* Highlight text */}
        {plan.highlight && (
          <p className="text-xs text-center text-muted-foreground mb-6">
            {plan.highlight}
          </p>
        )}

        {/* Features list */}
        <ul className="space-y-3">
          {plan.features.map((feature, featureIndex) => (
            <motion.li 
              key={feature} 
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + featureIndex * 0.05 }}
              className="flex items-start gap-3 text-sm"
            >
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                plan.color === "teal" 
                  ? "bg-teal/10 text-teal" 
                  : "bg-coral/10 text-coral"
              )}>
                <Check className="w-3 h-3" />
              </div>
              <span className="text-muted-foreground">{feature}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
