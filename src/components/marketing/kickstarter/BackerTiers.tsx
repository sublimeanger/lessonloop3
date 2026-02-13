import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Star, Zap, Award, Heart, Gem } from "lucide-react";

const tiers = [
  {
    name: "Supporter",
    price: 5,
    icon: Heart,
    color: "from-teal/20 to-teal/5",
    borderColor: "border-teal/20",
    features: [
      "Name on the supporters wall",
      "Early campaign updates",
      "Our eternal gratitude",
    ],
    delivery: "July 2026",
    popular: false,
  },
  {
    name: "Teacher Early Bird",
    price: 49,
    icon: Zap,
    color: "from-coral/20 to-coral/5",
    borderColor: "border-coral/30",
    features: [
      "1 year Teacher plan (save £95)",
      "Founding member badge",
      "Priority feature requests",
      "Early access before public launch",
    ],
    delivery: "July 2026",
    popular: true,
    limited: "Limited to 100 backers",
  },
  {
    name: "Studio Early Bird",
    price: 149,
    icon: Star,
    color: "from-teal/20 to-teal/5",
    borderColor: "border-teal/20",
    features: [
      "1 year Studio plan (save £199)",
      "Up to 5 teachers included",
      "Founding member badge",
      "Priority onboarding session",
      "Early access before public launch",
    ],
    delivery: "July 2026",
    popular: false,
    limited: "Limited to 50 backers",
  },
  {
    name: "Lifetime Teacher",
    price: 199,
    icon: Award,
    color: "from-coral/20 to-coral/5",
    borderColor: "border-coral/20",
    features: [
      "Lifetime Teacher plan — never pay again",
      "Founding member badge",
      "Name on the supporters wall",
      "All future features included",
    ],
    delivery: "July 2026",
    popular: false,
    limited: "Limited to 50 backers",
  },
  {
    name: "Lifetime Studio",
    price: 399,
    icon: Crown,
    color: "from-teal/20 to-teal/5",
    borderColor: "border-teal/20",
    features: [
      "Lifetime Studio plan — never pay again",
      "Up to 5 teachers included",
      "Founding member badge",
      "Priority support forever",
      "Name on the supporters wall",
    ],
    delivery: "July 2026",
    popular: false,
    limited: "Limited to 25 backers",
  },
  {
    name: "Champion",
    price: 500,
    icon: Gem,
    color: "from-coral/20 to-coral/5",
    borderColor: "border-coral/30",
    features: [
      "Everything in Lifetime Studio",
      "1-hour strategy call with the founder",
      "Your logo on our partners page",
      "Direct line to the product team",
      "Shape the product roadmap",
    ],
    delivery: "July 2026",
    popular: false,
    limited: "Limited to 10 backers",
  },
];

export function BackerTiers() {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-ink" />
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-[20%] left-[10%] w-[600px] h-[600px] opacity-20"
        style={{ background: "radial-gradient(circle, hsl(var(--teal) / 0.3) 0%, transparent 70%)", filter: "blur(80px)" }}
      />

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Choose Your Reward
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Back us at any level and help bring LessonLoop to music educators everywhere. Every tier includes early access.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`relative bg-white/5 backdrop-blur-xl border ${tier.popular ? "border-coral/40 ring-2 ring-coral/20" : tier.borderColor} rounded-2xl p-6 flex flex-col`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-coral text-white border-0 px-4 py-1">
                  Most Popular
                </Badge>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
                  <tier.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                </div>
              </div>

              <div className="mb-5">
                <span className="text-4xl font-extrabold text-white">£{tier.price}</span>
              </div>

              <ul className="space-y-3 flex-1 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                    <Check className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {tier.limited && (
                <p className="text-xs text-coral-light font-medium mb-3">{tier.limited}</p>
              )}

              <div className="text-xs text-white/40">
                Estimated delivery: {tier.delivery}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
