import { motion } from "framer-motion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { 
  Calendar, 
  Receipt, 
  Users, 
  Bell, 
  Sparkles, 
  Shield,
  BarChart3,
  Clock,
  FileText,
  CreditCard,
  MessageSquare,
  BookOpen,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

const featureCategories = [
  {
    title: "Scheduling",
    description: "Effortless calendar management",
    icon: Calendar,
    color: "teal",
    features: [
      {
        title: "Drag & Drop Calendar",
        description: "Intuitive visual calendar with week and month views. Move lessons with a simple drag.",
      },
      {
        title: "Recurring Lessons",
        description: "Set up weekly, fortnightly, or custom recurring schedules. Skip holidays automatically.",
      },
      {
        title: "Conflict Detection",
        description: "Real-time alerts when scheduling overlaps. Never double-book teachers or rooms.",
      },
      {
        title: "Room Management",
        description: "Track availability across multiple rooms and locations. Optimize space utilization.",
      },
    ],
  },
  {
    title: "Billing & Payments",
    description: "Get paid faster, stress less",
    icon: Receipt,
    color: "coral",
    features: [
      {
        title: "Automatic Invoicing",
        description: "Generate invoices in bulk based on lessons taught. Custom branding and VAT support.",
      },
      {
        title: "Online Payments",
        description: "Accept card payments directly through the parent portal. Instant reconciliation.",
      },
      {
        title: "Payment Reminders",
        description: "Automatic email reminders for overdue invoices. Customizable reminder schedules.",
      },
      {
        title: "Financial Reports",
        description: "Revenue tracking, outstanding balance reports, and payment history at a glance.",
      },
    ],
  },
  {
    title: "Parent Portal",
    description: "Professional experience for families",
    icon: Users,
    color: "teal",
    features: [
      {
        title: "Schedule Viewing",
        description: "Parents see their child's upcoming lessons, teacher details, and location info.",
      },
      {
        title: "Online Bill Pay",
        description: "Secure payment processing directly in the portal. View invoice history anytime.",
      },
      {
        title: "Practice Logging",
        description: "Students and parents can log practice sessions. Teachers review and provide feedback.",
      },
      {
        title: "Secure Messaging",
        description: "Direct communication channel between parents and teachers. Request schedule changes.",
      },
    ],
  },
  {
    title: "AI Assistant",
    description: "LoopAssist - your intelligent helper",
    icon: Sparkles,
    color: "coral",
    features: [
      {
        title: "Natural Language Queries",
        description: "Ask questions like 'How much am I owed this month?' and get instant answers.",
      },
      {
        title: "Smart Suggestions",
        description: "AI-powered recommendations for schedule optimization and billing reminders.",
      },
      {
        title: "Message Drafting",
        description: "Generate professional emails to parents with context-aware suggestions.",
      },
      {
        title: "Automated Actions",
        description: "Confirm to execute actions like sending reminders or generating invoices.",
      },
    ],
  },
];

const additionalFeatures = [
  { icon: Clock, title: "Time Tracking", description: "Accurate records for payroll and reporting" },
  { icon: FileText, title: "Custom Templates", description: "Branded invoices and email templates" },
  { icon: CreditCard, title: "Direct Debit", description: "GoCardless integration for recurring payments" },
  { icon: MessageSquare, title: "SMS Reminders", description: "Optional text message notifications" },
  { icon: BookOpen, title: "Resource Library", description: "Share sheet music and materials" },
  { icon: BarChart3, title: "Analytics Dashboard", description: "Track KPIs and business growth" },
  { icon: Shield, title: "GDPR Compliance", description: "Data export and deletion tools" },
  { icon: Bell, title: "Smart Notifications", description: "Customizable alert preferences" },
];

export default function Features() {
  return (
    <MarketingLayout>
      {/* Header Section */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero-light" />
        <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-coral/10 rounded-full blur-[120px]" />
        
        <div className="container mx-auto px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              Features
            </span>
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Powerful features,
              <br />
              <span className="text-muted-foreground">simple experience</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Everything you need to run a successful music teaching practice.
              Built by educators, for educators.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Feature Categories */}
      {featureCategories.map((category, categoryIndex) => (
        <section 
          key={category.title}
          className={cn(
            "py-20 lg:py-28",
            categoryIndex % 2 === 0 ? "bg-background" : "bg-muted/30"
          )}
        >
          <div className="container mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Text Content */}
              <motion.div
                initial={{ opacity: 0, x: categoryIndex % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className={cn(categoryIndex % 2 !== 0 && "lg:order-2")}
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-6",
                  category.color === "teal" 
                    ? "bg-gradient-to-br from-teal to-teal-dark" 
                    : "bg-gradient-to-br from-coral to-coral-dark"
                )}>
                  <category.icon className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                  {category.title}
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  {category.description}
                </p>
              </motion.div>

              {/* Feature Cards */}
              <motion.div
                initial={{ opacity: 0, x: categoryIndex % 2 === 0 ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className={cn(categoryIndex % 2 !== 0 && "lg:order-1")}
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  {category.features.map((feature, featureIndex) => (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: featureIndex * 0.1 }}
                      className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <Check className={cn(
                          "w-5 h-5 flex-shrink-0 mt-0.5",
                          category.color === "teal" ? "text-teal" : "text-coral"
                        )} />
                        <h3 className="font-semibold text-foreground">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground ml-8">
                        {feature.description}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      ))}

      {/* Additional Features Grid */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              And so much more...
            </h2>
            <p className="text-lg text-muted-foreground">
              Built-in tools for every aspect of your teaching practice.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {additionalFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="p-6 rounded-2xl bg-muted/50 hover:bg-muted transition-colors text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
