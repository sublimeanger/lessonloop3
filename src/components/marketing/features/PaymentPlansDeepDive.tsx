import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CalendarCheck, Bell, Eye, ShieldCheck, SplitSquareVertical } from "lucide-react";
import { useState, useEffect } from "react";

const instalments = [
  { label: "Instalment 1", date: "1 Sep", amount: "£40.00" },
  { label: "Instalment 2", date: "1 Oct", amount: "£40.00" },
  { label: "Instalment 3", date: "1 Nov", amount: "£40.00" },
];

const features = [
  { icon: SplitSquareVertical, text: "Split invoices into 2–12 instalments with flexible schedules" },
  { icon: CreditCard, text: "Automatic Stripe collection on each due date — no chasing" },
  { icon: Bell, text: "Overdue detection with automatic reminders to families" },
  { icon: Eye, text: "Full visibility for parents in their portal — track every payment" },
  { icon: ShieldCheck, text: "Credits preserved when plans are voided or adjusted" },
];

function InstalmentCard({ instalment, index }: { instalment: typeof instalments[0]; index: number }) {
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPaid(true), 1800 + index * 800);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.4 + index * 0.2 }}
      className="relative bg-card border border-border rounded-xl p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{instalment.label}</span>
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={paid ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-semibold"
        >
          <CalendarCheck className="w-3 h-3" /> Paid
        </motion.span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{instalment.date}</span>
        <span className="text-lg font-bold text-foreground">{instalment.amount}</span>
      </div>
      {!paid && (
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-primary/20"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

export function PaymentPlansDeepDive() {
  return (
    <section id="payment-plans" className="py-24 lg:py-36 relative overflow-hidden">
      {/* Dark cinematic background */}
      <div className="absolute inset-0 bg-[hsl(var(--ink))]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-primary/8 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-gradient-to-br from-teal/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <Badge variant="outline" className="mb-5 border-white/10 text-teal bg-white/[0.04]">
            <CreditCard className="w-3.5 h-3.5 mr-1.5" />
            Payment Plans
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Let families pay in instalments.
          </h2>
          <p className="mt-6 text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
            Split any invoice into monthly payments. Stripe handles the collection.
            You get paid on time, every time.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start max-w-6xl mx-auto">
          {/* Left: Animated invoice split visual */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white mb-4">Invoice → Instalments</h3>

            {/* Original invoice */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white">Invoice #INV-0042</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal/15 text-teal font-medium">
                  Term Fees
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/40">Autumn Term 2025</span>
                <span className="text-2xl font-bold text-white">£120.00</span>
              </div>
            </motion.div>

            {/* Arrow */}
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex justify-center origin-top"
            >
              <div className="w-px h-8 bg-white/10 relative">
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 border-b border-r border-white/20 rotate-45" />
              </div>
            </motion.div>

            {/* Instalment cards */}
            <div className="grid gap-3">
              {instalments.map((inst, i) => (
                <InstalmentCard key={i} instalment={inst} index={i} />
              ))}
            </div>
          </div>

          {/* Right: Feature list */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-6">What's included</h3>
            <ul className="space-y-5">
              {features.map((feat, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal/15 flex items-center justify-center shrink-0 mt-0.5">
                    <feat.icon className="w-4 h-4 text-teal" />
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed">{feat.text}</p>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
