import { motion } from "framer-motion";
import { User, Building2, Briefcase, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const useCases = [
  {
    icon: User,
    title: "Solo Teacher",
    subtitle: "I teach 20 students from home",
    color: "teal",
    features: [
      "Simple drag-and-drop scheduling",
      "Automated invoice generation",
      "Parent portal for payments",
      "Practice tracking with streaks",
      "LoopAssist for quick answers",
    ],
    quote: "I used to spend Sunday nights sorting invoices. Now it takes 5 minutes.",
    author: "Sarah, Piano Teacher",
  },
  {
    icon: Building2,
    title: "Music Academy",
    subtitle: "We have 8 teachers across 3 locations",
    color: "coral",
    features: [
      "Multi-teacher calendar views",
      "Room and resource booking",
      "Bulk invoicing by term",
      "Payroll reports by teacher",
      "Team permissions and roles",
    ],
    quote: "Managing 8 teachers used to be chaos. LessonLoop made it effortless.",
    author: "David, Academy Director",
  },
  {
    icon: Briefcase,
    title: "Peripatetic Agency",
    subtitle: "We place teachers in 15 schools",
    color: "primary",
    features: [
      "Location-based scheduling",
      "School-specific billing",
      "Teacher assignment tracking",
      "Comprehensive reporting",
      "White-label parent portal",
    ],
    quote: "We finally have visibility across all our placements in one place.",
    author: "Emma, Operations Manager",
  },
];

export function UseCasesSection() {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Built for You
          </span>
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-4">
            Whether you teach one
            <br />
            <span className="text-muted-foreground">or one thousand.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            LessonLoop scales with your needs—from independent teachers to large music organizations.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0",
                  useCase.color === "teal" && "bg-gradient-to-br from-teal to-teal-dark",
                  useCase.color === "coral" && "bg-gradient-to-br from-coral to-coral-dark",
                  useCase.color === "primary" && "bg-gradient-to-br from-primary to-primary/80"
                )}>
                  <useCase.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{useCase.title}</h3>
                  <p className="text-sm text-muted-foreground">{useCase.subtitle}</p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                {useCase.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                      useCase.color === "teal" && "bg-teal/20",
                      useCase.color === "coral" && "bg-coral/20",
                      useCase.color === "primary" && "bg-primary/20"
                    )}>
                      <ArrowRight className={cn(
                        "w-3 h-3",
                        useCase.color === "teal" && "text-teal",
                        useCase.color === "coral" && "text-coral",
                        useCase.color === "primary" && "text-primary"
                      )} />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Quote */}
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-sm text-muted-foreground italic mb-2">
                  "{useCase.quote}"
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  — {useCase.author}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
