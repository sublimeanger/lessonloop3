import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Receipt, 
  CreditCard, 
  Bell, 
  FileText,
  Percent,
  Clock,
  Check,
  Zap,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  { icon: Zap, title: "Bulk Invoice Generation", description: "Create invoices for all students in one click." },
  { icon: CreditCard, title: "Stripe Integration", description: "Accept card payments directly from the portal." },
  { icon: Bell, title: "Auto Reminders", description: "Polite payment reminders sent automatically." },
  { icon: Percent, title: "VAT Support", description: "UK VAT calculated and displayed automatically." },
  { icon: FileText, title: "PDF Invoices", description: "Professional branded invoices, instantly." },
  { icon: Clock, title: "Payment Terms", description: "Custom due dates and balance tracking." },
];

const invoiceStages = [
  { label: "Draft", color: "muted" },
  { label: "Sent", color: "primary" },
  { label: "Viewed", color: "teal" },
  { label: "Paid", color: "success" },
];

export function BillingDeepDive() {
  return (
    <section id="billing" className="py-24 lg:py-36 relative overflow-hidden">
      {/* Dark cinematic background */}
      <div className="absolute inset-0 bg-[hsl(var(--ink))]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }} />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-coral/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-teal/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left column: text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-5"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-coral/15 text-coral text-sm font-semibold mb-6">
              <Receipt className="w-4 h-4" />
              Billing & Payments
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 leading-[1.1]">
              Get paid faster.
              <br />
              <span className="text-white/40">Chase less.</span>
            </h2>

            <p className="text-lg text-white/50 mb-10 leading-relaxed">
              Turn teaching hours into revenue without the admin headache. 
              Generate invoices in bulk, accept online payments, and send 
              automatic reminders.
            </p>

            {/* Feature chips — 2-col */}
            <div className="grid sm:grid-cols-2 gap-3 mb-10">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-coral/30 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-coral/15 flex items-center justify-center">
                    <feature.icon className="w-4 h-4 text-coral" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white/90 text-sm">{feature.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <Link to="/features/billing" className="inline-flex items-center gap-2 text-sm font-semibold text-coral hover:gap-3 transition-all group">
              Explore invoicing and billing
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>

          {/* Right column: invoice demo */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-7"
          >
            <div className="relative bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden p-6 lg:p-8">
              {/* Invoice header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-semibold text-white">Invoice #247</h3>
                  <p className="text-sm text-white/40">Emma Smith — Piano Lessons</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">£180.00</p>
                  <p className="text-xs text-white/30">Inc. VAT</p>
                </div>
              </div>

              {/* Status flow */}
              <div className="relative mb-8">
                <div className="flex items-center justify-between relative z-10">
                  {invoiceStages.map((stage, index) => (
                    <motion.div
                      key={stage.label}
                      className="flex flex-col items-center"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + index * 0.2 }}
                    >
                      <motion.div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center mb-2 ring-2 ring-offset-2 ring-offset-[hsl(var(--ink))]",
                          stage.color === "success" 
                            ? "bg-success text-white ring-success/30" 
                            : stage.color === "teal"
                              ? "bg-teal text-white ring-teal/30"
                              : stage.color === "primary"
                                ? "bg-primary text-white ring-primary/30"
                                : "bg-white/20 text-white/60 ring-white/10"
                        )}
                        animate={index === 3 ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Check className="w-5 h-5" />
                      </motion.div>
                      <span className="text-xs font-medium text-white/70">{stage.label}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-white/10 -z-0">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary via-teal to-success"
                    initial={{ width: "0%" }}
                    whileInView={{ width: "100%" }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5, duration: 1.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Line items */}
              <div className="space-y-3 mb-6">
                {[
                  { desc: "Piano Lesson — 60 mins (4 sessions)", amount: "£150.00" },
                  { desc: "VAT @ 20%", amount: "£30.00" },
                ].map((item, index) => (
                  <motion.div
                    key={item.desc}
                    className="flex items-center justify-between py-3 border-b border-white/[0.06]"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                  >
                    <span className="text-sm text-white/50">{item.desc}</span>
                    <span className="font-medium text-white">{item.amount}</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-3">
                <div className="flex-1 py-3 rounded-xl bg-white/10 text-white text-sm font-medium text-center hover:bg-white/15 transition-colors cursor-default">
                  Download PDF
                </div>
                <div className="flex-1 py-3 rounded-xl bg-success text-white text-sm font-medium text-center">
                  Record Payment
                </div>
              </div>

              {/* Floating payment toast */}
              <motion.div
                className="absolute -top-4 -right-4 z-10"
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.5 }}
              >
                <motion.div
                  className="bg-success text-white rounded-xl p-4 shadow-xl shadow-success/20"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-medium">Payment received!</span>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
