import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const plans = [
  { name: "Teacher", price: "From £12/mo", tagline: "For solo music teachers" },
  { name: "Studio", price: "From £29/mo", tagline: "For multi-teacher schools" },
  { name: "Agency", price: "From £79/mo", tagline: "For large academies & agencies" },
];

export function UKPricing() {
  return (
    <section className="py-24 lg:py-32">
      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Simple pricing in pounds — no surprises
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-border bg-card p-6 text-center hover:border-primary/20 transition-colors"
            >
              <p className="font-semibold text-foreground text-lg">{plan.name}</p>
              <p className="text-2xl font-bold text-foreground mt-2">{plan.price}</p>
              <p className="text-sm text-muted-foreground mt-1">{plan.tagline}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-8 space-y-2">
          <p className="text-sm text-muted-foreground">
            All plans include: LoopAssist AI · Parent portal · Scheduling · Invoicing · GDPR compliance
          </p>
          <p className="text-sm text-muted-foreground">
            30-day free trial · No credit card required · Cancel anytime
          </p>
          <Link to="/pricing" className="inline-block mt-4 text-sm font-semibold text-primary hover:underline">
            See full pricing and compare plans →
          </Link>
        </div>
      </div>
    </section>
  );
}
