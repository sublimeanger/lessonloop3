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
  { icon: BarChart3, title: "Analytics Dashboard", description: "Track revenue, lesson counts, and outstanding payments with beautiful charts.", size: "large", color: "teal" },
  { icon: Music, title: "Practice Tracking", description: "Students log practice sessions. Track streaks and celebrate achievements.", size: "small", color: "coral" },
  { icon: BookOpen, title: "Resource Library", description: "Share sheet music, recordings, and materials directly with students.", size: "small", color: "teal" },
  { icon: MapPin, title: "Multi-Location", description: "Manage teaching spaces across multiple venues with room tracking.", size: "wide", color: "coral" },
  { icon: Users, title: "Team Management", description: "Add teachers, admins, and staff with role-based permissions.", size: "small", color: "teal" },
  { icon: Clock, title: "Attendance Tracking", description: "Mark attendance, track cancellations, and issue make-up credits.", size: "small", color: "coral" },
  { icon: FileSpreadsheet, title: "Payroll Reports", description: "Calculate teacher earnings based on lessons taught. Export for payroll.", size: "small", color: "teal" },
  { icon: FileText, title: "Custom Templates", description: "Create reusable email templates with merge fields for personalization.", size: "small", color: "coral" },
  { icon: Bell, title: "Smart Notifications", description: "Lesson reminders, payment alerts, and practice nudges via email.", size: "wide", color: "teal" },
  { icon: Repeat, title: "Make-up Credits", description: "Issue credits for cancelled lessons. Auto-apply to future invoices.", size: "small", color: "coral" },
  { icon: Shield, title: "Audit Logging", description: "Complete history of changes. Know who did what, and when.", size: "small", color: "teal" },
  { icon: Percent, title: "Rate Cards", description: "Define pricing per duration. Auto-apply rates when generating invoices.", size: "small", color: "coral" },
];

export function ExpandedFeaturesGrid() {
  return (
    <section id="more" className="py-24 lg:py-36 bg-background relative overflow-hidden">
      {/* Subtle top accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
      
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
            From practice tracking to payroll reports — we've thought of everything 
            so you can focus on what you do best.
          </p>
        </motion.div>

        {/* Bento grid with varied sizes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.04 }}
              className={cn(
                "relative bg-card border border-border rounded-2xl p-5 lg:p-6 cursor-default group",
                "hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5",
                feature.size === "large" && "col-span-2 row-span-2",
                feature.size === "wide" && "col-span-2",
              )}
            >
              {/* Hover gradient */}
              <div className={cn(
                "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                feature.color === "teal"
                  ? "bg-gradient-to-br from-teal/5 via-transparent to-transparent"
                  : "bg-gradient-to-br from-coral/5 via-transparent to-transparent"
              )} />

              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center mb-3 relative transition-colors",
                feature.color === "teal" ? "bg-teal/10 group-hover:bg-teal/15" : "bg-coral/10 group-hover:bg-coral/15"
              )}>
                <feature.icon className={cn(
                  "w-5 h-5",
                  feature.color === "teal" ? "text-teal" : "text-coral"
                )} />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5 text-sm lg:text-base relative">{feature.title}</h3>
              <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed relative">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
