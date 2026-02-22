import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Bell, CheckCircle, Clock, ShieldCheck, ListChecks, CalendarCheck, CreditCard as CreditCardIcon } from "lucide-react";

const flowSteps = [
  { icon: "❌", label: "Student cancels", sub: "Slot released automatically" },
  { icon: "🔍", label: "System checks waitlist", sub: "Matching students found" },
  { icon: "📧", label: "Parent notified", sub: "Email + portal offer sent" },
  { icon: "✅", label: "Parent accepts", sub: "Lesson booked, credit used" },
];

const features = [
  { icon: ListChecks, text: "Configurable absence policies — choose which reasons earn make-ups" },
  { icon: CreditCardIcon, text: "Automatic credit issuance when eligible absences are recorded" },
  { icon: CalendarCheck, text: "Waitlist with preference matching: teacher, location, and time" },
  { icon: Clock, text: "Expiry dates on make-up credits to keep your schedule moving" },
  { icon: ShieldCheck, text: "Full audit trail of every cancellation, credit, and redemption" },
];

export function MakeUpDeepDive() {
  return (
    <section id="makeups" className="py-24 lg:py-32 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-violet-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <Badge variant="outline" className="mb-5 border-primary/30 text-primary">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Make-Up Lessons
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Cancellations handled. Automatically.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            When a student cancels, LessonLoop finds matching slots, notifies eligible families,
            and fills the gap — without you lifting a finger.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start max-w-6xl mx-auto">
          {/* Left: Flow visualisation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground mb-6">How it works</h3>
            {flowSteps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative"
              >
                <div className="flex items-start gap-4 p-5 rounded-2xl border border-border bg-card">
                  <span className="text-2xl shrink-0 mt-0.5">{step.icon}</span>
                  <div>
                    <p className="font-semibold text-foreground">{step.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{step.sub}</p>
                  </div>
                  <span className="ml-auto text-xs font-mono text-muted-foreground/50 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                {i < flowSteps.length - 1 && (
                  <motion.div
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12 + 0.1, duration: 0.3 }}
                    className="w-px h-4 bg-border mx-auto origin-top"
                  />
                )}
              </motion.div>
            ))}
          </div>

          {/* Right: Feature list */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-6">What's included</h3>
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
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <feat.icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feat.text}</p>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
