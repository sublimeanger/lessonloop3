import { motion, useInView } from "framer-motion";
import {
  RefreshCw,
  CalendarCheck,
  Bell,
  MousePointerClick,
  CreditCard,
  Clock,
  FileText,
  X,
  ArrowDown,
  Check,
  Users,
} from "lucide-react";
import { useRef } from "react";

const features = [
  {
    icon: CalendarCheck,
    title: "Automatic Slot Detection",
    description: "Released slots are matched to waitlisted students instantly.",
  },
  {
    icon: Bell,
    title: "Parent Notification",
    description: "Eligible families receive make-up offers via email and portal.",
  },
  {
    icon: MousePointerClick,
    title: "One-Click Accept",
    description: "Parents accept directly from the portal. Lesson books automatically.",
  },
  {
    icon: CreditCard,
    title: "Credit Management",
    description: "Make-up credits issued automatically based on your absence policy.",
  },
  {
    icon: Clock,
    title: "Expiry Control",
    description: "Set expiry windows on credits. Configurable per policy.",
  },
  {
    icon: FileText,
    title: "Full Audit Trail",
    description: "Every cancellation, credit, and rebooking logged.",
  },
];

const flowSteps = [
  {
    icon: X,
    label: "Student Cancels",
    detail: "Oliver — Piano, Wed 3pm",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  {
    icon: CalendarCheck,
    label: "Slot Released",
    detail: "Wed 3pm now available",
    color: "text-teal",
    bg: "bg-teal/10",
  },
  {
    icon: Users,
    label: "Waitlist Checked",
    detail: "2 eligible students found",
    color: "text-primary",
    bg: "bg-primary/10",
    names: ["Emma S.", "James T."],
  },
  {
    icon: Bell,
    label: "Parent Notified",
    detail: "Email + portal notification sent",
    color: "text-coral",
    bg: "bg-coral/10",
  },
  {
    icon: Check,
    label: "Lesson Booked ✓",
    detail: "Emma accepted — confirmed",
    color: "text-success",
    bg: "bg-success/10",
  },
];

export function MakeUpDeepDive() {
  const flowRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(flowRef, { once: true, margin: "-100px" });

  return (
    <section id="makeups" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-teal uppercase tracking-wider">
                Make-Up Lessons
              </span>
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6">
              Cancellations handled.
              <br />
              <span className="text-muted-foreground">Automatically.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-10">
              When a student cancels, LessonLoop finds matching available slots, 
              notifies eligible families, and fills the gap — without you lifting a finger.
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
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-teal/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-teal" />
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

          {/* Right: Animated Flow Diagram */}
          <motion.div
            ref={flowRef}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="space-y-0">
              {flowSteps.map((step, i) => (
                <div key={step.label}>
                  {/* Step Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                    transition={{ delay: i * 0.4, duration: 0.5 }}
                    className="bg-card border border-border rounded-xl p-4 relative"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${step.bg} flex items-center justify-center flex-shrink-0`}>
                        <step.icon className={`w-5 h-5 ${step.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.detail}</p>
                      </div>
                    </div>
                    {/* Waitlist names */}
                    {step.names && (
                      <div className="mt-3 ml-[52px] space-y-1">
                        {step.names.map((name) => (
                          <div
                            key={name}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-foreground">
                              {name[0]}
                            </div>
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {/* Connecting Arrow */}
                  {i < flowSteps.length - 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ delay: i * 0.4 + 0.25, duration: 0.3 }}
                      className="flex justify-center py-1"
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-px h-3 border-l border-dashed border-border" />
                        <ArrowDown className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
