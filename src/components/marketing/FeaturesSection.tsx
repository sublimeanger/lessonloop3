import { motion } from "framer-motion";
import { 
  Calendar, 
  Receipt, 
  Users, 
  Bell, 
  Sparkles, 
  Shield, 
  Clock, 
  TrendingUp,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Drag-and-drop calendar with conflict detection, recurring lessons, and room management. Never double-book again.",
    color: "teal",
    highlights: ["Drag & drop interface", "Conflict detection", "Recurring lessons", "Room management"],
  },
  {
    icon: Receipt,
    title: "Automated Invoicing",
    description: "Generate invoices in bulk, accept online payments, and send automatic reminders. Get paid faster.",
    color: "coral",
    highlights: ["Bulk invoice generation", "Online payments", "Automatic reminders", "VAT support"],
  },
  {
    icon: Users,
    title: "Parent Portal",
    description: "Give parents their own login to view schedules, pay invoices, and track their child's progress.",
    color: "teal",
    highlights: ["Dedicated login", "Schedule viewing", "Online payments", "Progress tracking"],
  },
  {
    icon: Sparkles,
    title: "AI Assistant",
    description: "LoopAssist answers questions about your schedule and finances, drafts messages, and suggests actions.",
    color: "coral",
    highlights: ["Natural language queries", "Message drafting", "Smart suggestions", "Action automation"],
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Automated reminders for lessons, invoices, and cancellations. Keep everyone in the loop.",
    color: "teal",
    highlights: ["Lesson reminders", "Payment alerts", "Cancellation notices", "Custom templates"],
  },
  {
    icon: Shield,
    title: "UK Compliant",
    description: "Built for British music educators. GBP, VAT, term calendars, and GDPR compliance baked in.",
    color: "coral",
    highlights: ["GDPR compliant", "VAT ready", "UK bank holidays", "Term calendar"],
  },
];

const stats = [
  { value: "50,000+", label: "Lessons Scheduled Monthly", icon: Clock },
  { value: "£2M+", label: "Invoices Processed", icon: Receipt },
  { value: "99.9%", label: "Uptime Guarantee", icon: TrendingUp },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

export function FeaturesSection() {
  return (
    <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-coral/5 to-transparent rounded-full blur-3xl" />

      <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            Features
          </span>
          <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground leading-tight">
            Everything you need.
            <br />
            <span className="text-muted-foreground">Nothing you don't.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Purpose-built for music educators. Powerful enough for academies, 
            simple enough for solo teachers.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
        >
          {features.map((feature, _index) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className="group relative"
            >
              <div className="relative h-full p-8 rounded-3xl border border-border bg-card hover:border-primary/30 transition-all duration-500 overflow-hidden">
                {/* Hover Gradient */}
                <div className={cn(
                  "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                  feature.color === "teal" 
                    ? "bg-gradient-to-br from-teal/5 via-transparent to-transparent" 
                    : "bg-gradient-to-br from-coral/5 via-transparent to-transparent"
                )} />

                {/* Icon */}
                <div className={cn(
                  "relative w-14 h-14 rounded-2xl flex items-center justify-center mb-6",
                  feature.color === "teal" 
                    ? "bg-gradient-to-br from-teal to-teal-dark" 
                    : "bg-gradient-to-br from-coral to-coral-dark"
                )}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="relative text-xl font-bold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="relative text-muted-foreground mb-6">
                  {feature.description}
                </p>

                {/* Highlights */}
                <ul className="relative space-y-2">
                  {feature.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className={cn(
                        "w-4 h-4 flex-shrink-0",
                        feature.color === "teal" ? "text-teal" : "text-coral"
                      )} />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-24 p-8 lg:p-12 rounded-3xl bg-gradient-to-r from-ink to-ink-light overflow-hidden relative"
        >
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-coral/10 rounded-full blur-3xl" />

          <div className="relative grid md:grid-cols-3 gap-8 lg:gap-12">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 mx-auto mb-4">
                  <stat.icon className="w-6 h-6 text-teal-light" />
                </div>
                <div className="text-4xl lg:text-5xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-white/60">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
