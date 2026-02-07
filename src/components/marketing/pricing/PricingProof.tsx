import { motion } from "framer-motion";
import { Quote, Calendar, Receipt, MessageSquare } from "lucide-react";

const highlights = [
  {
    icon: Calendar,
    title: "Scheduling that makes sense",
    description: "Recurring lessons, term dates, conflict detection, and room booking — all in one calendar.",
  },
  {
    icon: Receipt,
    title: "Billing that just works",
    description: "Automated billing runs, professional invoices, payment tracking, and UK VAT support.",
  },
  {
    icon: MessageSquare,
    title: "Communication sorted",
    description: "Built-in parent portal, messaging, and practice tracking. No more endless chasing.",
  },
];

export function PricingProof() {
  return (
    <section className="py-16 lg:py-20 border-y border-border bg-muted/20">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Founder quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center mb-12"
        >
          <Quote className="w-8 h-8 text-primary/20 mx-auto mb-4" />
          <p className="text-lg text-foreground italic leading-relaxed mb-4">
            "I built LessonLoop because I wanted a system that worked the way music teaching actually works. Not a generic calendar. Not a patchwork of apps."
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal to-primary flex items-center justify-center text-white font-semibold text-sm">
              LT
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground text-sm">Lauren Twilley</p>
              <p className="text-xs text-muted-foreground">Founder · Piano Teacher</p>
            </div>
          </div>
        </motion.div>
        
        {/* Feature highlights */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {highlights.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative bg-card border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-lg transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              
              <h3 className="font-semibold text-foreground mb-2">
                {item.title}
              </h3>
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
