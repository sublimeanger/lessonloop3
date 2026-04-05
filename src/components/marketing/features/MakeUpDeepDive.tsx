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
  ArrowRight,
} from "lucide-react";
import { useRef } from "react";
import { makeupsReal } from "@/assets/marketing";
import { BrowserFrameLight } from "@/components/marketing/BrowserFrame";

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
    border: "border-destructive/20",
  },
  {
    icon: CalendarCheck,
    label: "Slot Released",
    detail: "Wed 3pm now available",
    color: "text-teal",
    bg: "bg-teal/10",
    border: "border-teal/20",
  },
  {
    icon: Users,
    label: "Waitlist Checked",
    detail: "2 eligible students found",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    names: ["Emma S.", "James T."],
  },
  {
    icon: Bell,
    label: "Parent Notified",
    detail: "Email + portal notification sent",
    color: "text-coral",
    bg: "bg-coral/10",
    border: "border-coral/20",
  },
  {
    icon: Check,
    label: "Lesson Booked ✓",
    detail: "Emma accepted — confirmed",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
  },
];

export function MakeUpDeepDive() {
  const flowRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(flowRef, { once: true, margin: "-100px" });

  return (
    <section id="makeups" className="py-24 lg:py-36 bg-background relative overflow-hidden">
      {/* Accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center shadow-lg shadow-teal/20">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-teal uppercase tracking-wider">
                Make-Up Lessons
              </span>
            </div>

            <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6 leading-[1.1]">
              Cancellations handled.
              <br />
              <span className="text-muted-foreground">Automatically.</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
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
                  transition={{ delay: index * 0.08 }}
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

          {/* Right: Real product screenshot */}
          <motion.div
            ref={flowRef}
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <BrowserFrameLight url="app.lessonloop.net/make-ups">
              <img
                src={makeupsReal}
                alt="LessonLoop make-up lesson management showing credits, available slots, and automatic parent notifications"
                className="w-full h-auto block"
                loading="lazy"
              />
            </BrowserFrameLight>

            {/* Floating flow summary */}
            <motion.div
              className="absolute -bottom-4 -left-4 z-10 hidden sm:block"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8 }}
            >
              <motion.div
                className="bg-card border border-border rounded-xl p-3 shadow-xl"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Make-up booked</p>
                    <p className="text-[10px] text-muted-foreground">Emma accepted Wed 3pm</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
