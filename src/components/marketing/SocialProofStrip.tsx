import { motion } from "framer-motion";
import { Shield, Sparkles, Clock, CreditCard, PoundSterling } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const badges: { icon: LucideIcon | null; emoji?: string; label: string }[] = [
  { icon: null, emoji: "🇬🇧", label: "Built in the UK" },
  { icon: Shield, label: "GDPR Compliant" },
  { icon: CreditCard, label: "Stripe Payments" },
  { icon: Sparkles, label: "AI-Powered" },
  { icon: Clock, label: "30-Day Free Trial" },
  { icon: PoundSterling, label: "From £12/mo" },
];

export function SocialProofStrip() {
  return (
    <section className="py-5 border-y border-border bg-muted/30">
      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-2.5 sm:gap-y-3">
          {badges.map((badge, i) => (
            <motion.div
              key={badge.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border text-sm text-muted-foreground"
            >
              {badge.emoji ? (
                <span className="text-lg leading-none">{badge.emoji}</span>
              ) : badge.icon ? (
                <badge.icon className="w-4 h-4 text-primary" />
              ) : null}
              <span className="font-medium">{badge.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
