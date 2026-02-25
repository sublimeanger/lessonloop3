import { motion } from "framer-motion";
import { 
  BarChart3, 
  BookOpen, 
  Users, 
  Clock, 
  FileSpreadsheet,
  Music,
  MapPin,
  FileText,
  Bell,
  Shield,
  Repeat,
  Percent
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  { icon: BarChart3, title: "Analytics Dashboard", description: "Track revenue, lesson counts, and outstanding payments with beautiful charts.", span: "col-span-2 row-span-2", color: "teal", accent: true },
  { icon: Music, title: "Practice Tracking", description: "Students log practice sessions. Track streaks and celebrate achievements.", span: "", color: "coral" },
  { icon: BookOpen, title: "Resource Library", description: "Share sheet music, recordings, and materials directly with students.", span: "", color: "teal" },
  { icon: MapPin, title: "Multi-Location", description: "Manage teaching spaces across multiple venues with room tracking.", span: "col-span-2", color: "coral" },
  { icon: Users, title: "Team Management", description: "Add teachers, admins, and staff with role-based permissions.", span: "", color: "teal" },
  { icon: Clock, title: "Attendance Tracking", description: "Mark attendance, track cancellations, and issue make-up credits.", span: "", color: "coral" },
  { icon: FileSpreadsheet, title: "Payroll Reports", description: "Calculate teacher earnings based on lessons taught. Export for payroll.", span: "", color: "teal" },
  { icon: FileText, title: "Custom Templates", description: "Create reusable email templates with merge fields for personalization.", span: "", color: "coral" },
  { icon: Bell, title: "Smart Notifications", description: "Lesson reminders, payment alerts, and practice nudges via email.", span: "col-span-2", color: "teal" },
  { icon: Repeat, title: "Make-up Credits", description: "Issue credits for cancelled lessons. Auto-apply to future invoices.", span: "", color: "coral" },
  { icon: Shield, title: "Audit Logging", description: "Complete history of changes. Know who did what, and when.", span: "", color: "teal" },
  { icon: Percent, title: "Rate Cards", description: "Define pricing per duration. Auto-apply rates when generating invoices.", span: "", color: "coral" },
];

export function ExpandedFeaturesGrid() {
  return (
    <section id="more" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            And so much more
          </span>
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
            Built for every aspect
            <br />
            <span className="text-muted-foreground">of your teaching practice.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From practice tracking to payroll reports, we've thought of everything 
            so you can focus on what you do best—teaching.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.04 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={cn(
                "relative bg-card border border-border rounded-2xl p-5 lg:p-6 cursor-default",
                "hover:border-primary/30 transition-colors",
                feature.span
              )}
            >
              {feature.accent && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal/5 via-transparent to-coral/5 pointer-events-none" />
              )}
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center mb-3 relative",
                feature.color === "teal" ? "bg-teal/10" : "bg-coral/10"
              )}>
                <feature.icon className={cn(
                  "w-5 h-5",
                  feature.color === "teal" ? "text-teal" : "text-coral"
                )} />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5 text-sm lg:text-base">{feature.title}</h3>
              <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
