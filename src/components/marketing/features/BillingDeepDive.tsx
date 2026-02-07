import { motion } from "framer-motion";
import { 
  Receipt, 
  CreditCard, 
  Bell, 
  FileText,
  Percent,
  Clock,
  Check,
  ArrowRight,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Zap,
    title: "Bulk Invoice Generation",
    description: "Create invoices for all students in one click. Term or monthly billing.",
  },
  {
    icon: CreditCard,
    title: "Stripe Integration",
    description: "Accept card payments directly. Parents pay from the portal.",
  },
  {
    icon: Bell,
    title: "Auto Reminders",
    description: "Polite payment reminders sent automatically before and after due dates.",
  },
  {
    icon: Percent,
    title: "VAT Support",
    description: "UK VAT registration? We calculate and display VAT automatically.",
  },
  {
    icon: FileText,
    title: "PDF Invoices",
    description: "Professional invoices with your branding. Download or email instantly.",
  },
  {
    icon: Clock,
    title: "Payment Terms",
    description: "Set due dates and payment terms. Track outstanding balances.",
  },
];

const invoiceStages = [
  { label: "Draft", color: "muted" },
  { label: "Sent", color: "primary" },
  { label: "Viewed", color: "teal" },
  { label: "Paid", color: "success" },
];

export function BillingDeepDive() {
  return (
    <section id="billing" className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Interactive Demo */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative order-2 lg:order-1"
          >
            {/* Invoice flow visualization */}
            <div className="relative bg-card rounded-2xl border border-border shadow-2xl overflow-hidden p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-foreground">Invoice #247</h3>
                  <p className="text-sm text-muted-foreground">Emma Smith - Piano Lessons</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">£180.00</p>
                  <p className="text-xs text-muted-foreground">Inc. VAT</p>
                </div>
              </div>

              {/* Invoice status flow */}
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
                          "w-10 h-10 rounded-full flex items-center justify-center mb-2",
                          index <= 3 
                            ? stage.color === "success" 
                              ? "bg-success text-success-foreground" 
                              : stage.color === "teal"
                                ? "bg-teal text-white"
                                : "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                        animate={index === 3 ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        {index <= 3 ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <span className="text-sm">{index + 1}</span>
                        )}
                      </motion.div>
                      <span className={cn(
                        "text-xs font-medium",
                        index <= 3 ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {stage.label}
                      </span>
                    </motion.div>
                  ))}
                </div>
                {/* Progress line */}
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted -z-0">
                  <motion.div
                    className="h-full bg-success"
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
                  { desc: "Piano Lesson - 60 mins (4 sessions)", amount: "£150.00" },
                  { desc: "VAT @ 20%", amount: "£30.00" },
                ].map((item, index) => (
                  <motion.div
                    key={item.desc}
                    className="flex items-center justify-between py-2 border-b border-border"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                  >
                    <span className="text-sm text-muted-foreground">{item.desc}</span>
                    <span className="font-medium text-foreground">{item.amount}</span>
                  </motion.div>
                ))}
              </div>

              {/* Action buttons */}
              <motion.div
                className="flex gap-3"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.2 }}
              >
                <div className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium text-center">
                  Download PDF
                </div>
                <div className="flex-1 py-2.5 rounded-lg bg-success text-success-foreground text-sm font-medium text-center">
                  Record Payment
                </div>
              </motion.div>
            </div>

            {/* Floating notification */}
            <motion.div
              className="absolute -top-4 -right-4 z-10"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 1.5 }}
            >
              <motion.div
                className="bg-success text-success-foreground rounded-xl p-4 shadow-lg"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm font-medium">Payment received!</span>
                </div>
              </motion.div>
            </motion.div>

          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="order-1 lg:order-2"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-coral uppercase tracking-wider">
                Billing & Payments
              </span>
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6">
              Get paid faster.
              <br />
              <span className="text-muted-foreground">Chase less.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-10">
              Turn teaching hours into revenue without the admin headache. 
              Generate invoices in bulk, accept online payments, and let 
              automatic reminders do the chasing for you.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-3"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-coral/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-coral" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
