import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { UserPlus, Calendar, CreditCard, Sparkles } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Set Up Your Schedule",
    time: "~15 minutes",
    description: "Import your students or add them manually. Configure your availability, locations, and rate cards in minutes.",
    icon: Calendar,
    color: "from-teal to-teal-dark",
  },
  {
    number: "02",
    title: "Invite Parents & Students",
    time: "one-click invites",
    description: "Send portal invites so families can view schedules, pay invoices, and message you directly.",
    icon: UserPlus,
    color: "from-coral to-coral-dark",
  },
  {
    number: "03",
    title: "Get Paid Automatically",
    time: "Stripe in 2 minutes",
    description: "Generate invoices in bulk, send automatic reminders, and accept online payments with Stripe.",
    icon: CreditCard,
    color: "from-violet-500 to-violet-600",
  },
  {
    number: "04",
    title: "Ask LoopAssist Anything",
    time: "built in, no setup",
    description: "Ask LoopAssist anything about your schedule or finances. Get smart suggestions and automate routine tasks.",
    icon: Sparkles,
    color: "from-amber-500 to-amber-600",
  },
];

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section className="py-24 lg:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative" ref={containerRef}>
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-teal/10 text-teal text-sm font-semibold mb-6">
            How it works
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Up and running
            <br />
            <span className="text-muted-foreground">in four simple steps</span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-border">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-teal via-coral to-violet-500 origin-left"
            />
          </div>

          {/* Step Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative"
              >
                {/* Number Badge */}
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.15, type: "spring", stiffness: 200 }}
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-lg shadow-lg mb-6 relative z-10`}
                >
                  <step.icon className="w-6 h-6" />
                </motion.div>

                {/* Content */}
                <div className="relative">
                  <div className="text-6xl font-extrabold text-muted/20 absolute -top-4 -left-2 select-none">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-1 relative">
                    {step.title}
                  </h3>
                  <p className="text-xs font-medium text-primary mb-3 relative">
                    ({step.time})
                  </p>
                  <p className="text-muted-foreground relative">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-20 text-center"
        >
          <p className="text-muted-foreground mb-4">
            Ready to simplify your teaching practice?
          </p>
          <motion.a
            href="/signup"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg hover:shadow-xl transition-shadow"
          >
            Start free trial
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              →
            </motion.span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
