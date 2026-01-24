import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
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
import { useRef } from "react";

const features = [
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track revenue, lesson counts, and outstanding payments with beautiful charts.",
    size: "large",
    color: "teal",
  },
  {
    icon: Music,
    title: "Practice Tracking",
    description: "Students log practice sessions. Track streaks and celebrate achievements.",
    size: "normal",
    color: "coral",
  },
  {
    icon: BookOpen,
    title: "Resource Library",
    description: "Share sheet music, recordings, and materials directly with students.",
    size: "normal",
    color: "teal",
  },
  {
    icon: MapPin,
    title: "Multi-Location",
    description: "Manage teaching spaces across multiple venues with room tracking.",
    size: "normal",
    color: "coral",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Add teachers, admins, and staff with role-based permissions.",
    size: "normal",
    color: "teal",
  },
  {
    icon: Clock,
    title: "Attendance Tracking",
    description: "Mark attendance, track cancellations, and issue make-up credits.",
    size: "large",
    color: "coral",
  },
  {
    icon: FileSpreadsheet,
    title: "Payroll Reports",
    description: "Calculate teacher earnings based on lessons taught. Export for payroll.",
    size: "normal",
    color: "teal",
  },
  {
    icon: FileText,
    title: "Custom Templates",
    description: "Create reusable email templates with merge fields for personalization.",
    size: "normal",
    color: "coral",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description: "Lesson reminders, payment alerts, and practice nudges via email.",
    size: "normal",
    color: "teal",
  },
  {
    icon: Repeat,
    title: "Make-up Credits",
    description: "Issue credits for cancelled lessons. Auto-apply to future invoices.",
    size: "normal",
    color: "coral",
  },
  {
    icon: Shield,
    title: "Audit Logging",
    description: "Complete history of changes. Know who did what, and when.",
    size: "normal",
    color: "teal",
  },
  {
    icon: Percent,
    title: "Rate Cards",
    description: "Define pricing per duration. Auto-apply rates when generating invoices.",
    size: "normal",
    color: "coral",
  },
];

interface FeatureCardProps {
  feature: typeof features[0];
  index: number;
}

function FeatureCard({ feature, index }: FeatureCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseYSpring = useSpring(y, { stiffness: 500, damping: 100 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={cn(
        "relative bg-card border border-border rounded-2xl p-6 cursor-default",
        "hover:border-primary/30 transition-colors",
        feature.size === "large" && "sm:col-span-2"
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
        feature.color === "teal" ? "bg-teal/10" : "bg-coral/10"
      )}>
        <feature.icon className={cn(
          "w-6 h-6",
          feature.color === "teal" ? "text-teal" : "text-coral"
        )} />
      </div>
      <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {feature.description}
      </p>
    </motion.div>
  );
}

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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
