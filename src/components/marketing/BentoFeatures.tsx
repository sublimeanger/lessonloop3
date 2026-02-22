import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { 
  Calendar, 
  Receipt, 
  Users, 
  Bell, 
  Shield,
  CreditCard,
  MessageSquare,
  BarChart3,
  Repeat,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MouseEvent } from "react";

// Bento card with 3D tilt and gradient border
function BentoCard({ 
  children, 
  className,
  size = "normal"
}: { 
  children: React.ReactNode; 
  className?: string;
  size?: "normal" | "large" | "wide";
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const sizeClasses = {
    normal: "col-span-1 row-span-1",
    large: "col-span-1 row-span-2 md:col-span-1",
    wide: "col-span-1 md:col-span-2 row-span-1",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative rounded-3xl border border-border bg-card overflow-hidden",
        sizeClasses[size],
        className
      )}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
    >
      {/* Gradient follow effect */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              350px circle at ${mouseX}px ${mouseY}px,
              hsl(var(--teal) / 0.15),
              transparent 80%
            )
          `,
        }}
      />
      
      {/* Content */}
      <div className="relative h-full p-6 lg:p-8">
        {children}
      </div>
    </motion.div>
  );
}

// Mini animated calendar demo
function CalendarDemo() {
  const days = ["M", "T", "W", "T", "F"];
  const lessons = [
    [true, false, true, false, true],
    [false, true, false, true, false],
    [true, true, false, true, true],
  ];

  return (
    <div className="mt-6 p-4 rounded-2xl bg-muted/50 border border-border">
      <div className="flex justify-between mb-3">
        {days.map((day, i) => (
          <div key={i} className="text-xs text-muted-foreground font-medium w-8 text-center">{day}</div>
        ))}
      </div>
      <div className="space-y-2">
        {lessons.map((week, weekIdx) => (
          <div key={weekIdx} className="flex justify-between">
            {week.map((hasLesson, dayIdx) => (
              <motion.div
                key={dayIdx}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{ delay: 0.5 + (weekIdx * 5 + dayIdx) * 0.05 }}
                viewport={{ once: true }}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium",
                  hasLesson 
                    ? "bg-gradient-to-br from-teal to-teal-dark text-white" 
                    : "bg-background text-muted-foreground"
                )}
              >
                {weekIdx * 7 + dayIdx + 1}
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Mini invoice animation
function InvoiceDemo() {
  const items = [
    { name: "Piano Lesson x4", amount: "£120" },
    { name: "Theory Book", amount: "£15" },
  ];

  return (
    <div className="mt-6 space-y-3">
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        whileInView={{ x: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="p-4 rounded-2xl bg-muted/50 border border-border"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-foreground">Invoice #247</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">Pending</span>
        </div>
        {items.map((item, i) => (
          <div key={i} className="flex justify-between text-xs text-muted-foreground py-1">
            <span>{item.name}</span>
            <span className="tabular-nums">{item.amount}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-semibold text-foreground pt-2 mt-2 border-t border-border">
          <span>Total</span>
          <span className="tabular-nums">£135</span>
        </div>
      </motion.div>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.6 }}
        className="flex gap-2"
      >
        <div className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium text-center">
          Send Invoice
        </div>
        <div className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground">
          PDF
        </div>
      </motion.div>
    </div>
  );
}

// Feature list
function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {features.map((feature, i) => (
        <motion.li
          key={feature}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.1 }}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <div className="w-1 h-1 rounded-full bg-teal" />
          {feature}
        </motion.li>
      ))}
    </ul>
  );
}

// Compact "And more" items
const moreFeatures = [
  { icon: CreditCard, label: "Online Payments", desc: "Card payments via Stripe with auto reconciliation" },
  { icon: Bell, label: "Smart Reminders", desc: "Automated lesson & payment reminders" },
  { icon: Repeat, label: "Recurring Lessons", desc: "Weekly patterns that skip closures" },
  { icon: MessageSquare, label: "Messaging", desc: "In-app messaging with email templates" },
  { icon: BarChart3, label: "Reports", desc: "Revenue, utilisation & attendance analytics" },
  { icon: Shield, label: "UK Compliant", desc: "GDPR, VAT, bank holidays & term dates" },
];

export function BentoFeatures() {
  return (
    <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-coral/5 to-transparent rounded-full blur-3xl" />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6"
          >
            Features
          </motion.span>
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

        {/* Bento Grid — Hero cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Smart Scheduling - Large */}
          <BentoCard size="large" className="lg:row-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Smart Scheduling</h3>
                <p className="text-sm text-muted-foreground">Drag, drop, done</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              Intuitive calendar with conflict detection, recurring lessons, and room management.
            </p>
            <CalendarDemo />
            <FeatureList features={["Conflict detection", "Recurring lessons", "Room booking", "Closure dates"]} />
          </BentoCard>

          {/* Automated Invoicing */}
          <BentoCard>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Automated Invoicing</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Generate invoices in bulk, accept payments online, and send automatic reminders.
            </p>
            <InvoiceDemo />
          </BentoCard>

          {/* Make-Up Matching — NEW */}
          <BentoCard>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Make-Up Matching</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Cancelled slots are automatically offered to waitlisted families. No revenue lost.
            </p>
            <FeatureList features={["Auto slot detection", "Parent notification", "One-click accept", "Make-up credits"]} />
          </BentoCard>

          {/* Parent Portal - Wide */}
          <BentoCard size="wide">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Parent Portal</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Give parents their own login to view schedules, pay invoices, track practice, and message you directly.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["View Schedule", "Pay Online", "Track Practice", "Message Teacher"].map((item) => (
                    <span key={item} className="px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="w-40 h-72 rounded-3xl bg-muted border-4 border-foreground/10 relative overflow-hidden"
                >
                  <div className="absolute inset-2 rounded-2xl bg-card overflow-hidden">
                    <div className="p-3 border-b border-border">
                      <div className="text-xs font-semibold text-foreground">Emma's Schedule</div>
                    </div>
                    <div className="p-3 space-y-2">
                      {[
                        { day: "Mon", time: "4pm", type: "Piano" },
                        { day: "Wed", time: "4pm", type: "Piano" },
                      ].map((lesson, i) => (
                        <motion.div
                          key={i}
                          initial={{ x: -20, opacity: 0 }}
                          whileInView={{ x: 0, opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.5 + i * 0.2 }}
                          className="p-2 rounded-lg bg-teal/10 border border-teal/20"
                        >
                          <div className="text-xs font-medium text-foreground">{lesson.day} {lesson.time}</div>
                          <div className="text-xs text-muted-foreground">{lesson.type}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </BentoCard>
        </div>

        {/* "And more…" compact grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12"
        >
          <h3 className="text-lg font-semibold text-muted-foreground text-center mb-6">And more…</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {moreFeatures.map((feat, i) => (
              <motion.div
                key={feat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card"
              >
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <feat.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{feat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
