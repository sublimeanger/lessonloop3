import { motion } from "framer-motion";
import { User, Building2, Briefcase, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
    benefit: "The ideal private music teacher software — set up billing once, and invoices generate themselves every term.",
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
    benefit: "The complete music academy management software — see every teacher's schedule, room booking, and payroll in one place.",
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
    benefit: "Purpose-built peripatetic music teacher scheduling — track every placement, teacher, and school from a single dashboard.",
  },
];

export function UseCasesSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = useCases[activeIndex];

  return (
    <section className="py-24 lg:py-36 bg-background relative overflow-hidden">
      {/* Accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-border to-transparent" />
      
      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
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
            LessonLoop scales with your needs — from independent teachers to large music organisations.
          </p>
        </motion.div>

        {/* Tab selector */}
        <div className="flex justify-center gap-2 mb-10">
          {useCases.map((uc, index) => (
            <button
              key={uc.title}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium transition-all border",
                activeIndex === index
                  ? cn(
                      "text-white border-transparent shadow-lg",
                      uc.color === "teal" && "bg-teal shadow-teal/20",
                      uc.color === "coral" && "bg-coral shadow-coral/20",
                      uc.color === "primary" && "bg-primary shadow-primary/20",
                    )
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              )}
            >
              <uc.icon className="w-4 h-4" />
              {uc.title}
            </button>
          ))}
        </div>

        {/* Active use case */}
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="max-w-4xl mx-auto"
        >
          <div className="bg-card border border-border rounded-2xl p-8 lg:p-10 shadow-lg">
            <div className="lg:flex lg:gap-10">
              {/* Left: info */}
              <div className="lg:w-1/2 mb-8 lg:mb-0">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg",
                  active.color === "teal" && "bg-gradient-to-br from-teal to-teal-dark shadow-teal/20",
                  active.color === "coral" && "bg-gradient-to-br from-coral to-coral-dark shadow-coral/20",
                  active.color === "primary" && "bg-gradient-to-br from-primary to-primary/80 shadow-primary/20"
                )}>
                  <active.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-1">{active.title}</h3>
                <p className="text-muted-foreground mb-6">{active.subtitle}</p>
                <div className={cn(
                  "rounded-xl p-4 border",
                  active.color === "teal" && "bg-teal/5 border-teal/15",
                  active.color === "coral" && "bg-coral/5 border-coral/15",
                  active.color === "primary" && "bg-primary/5 border-primary/15",
                )}>
                  <p className="text-sm font-medium text-foreground leading-relaxed">{active.benefit}</p>
                </div>
              </div>

              {/* Right: features */}
              <div className="lg:w-1/2 space-y-3">
                {active.features.map((feature, i) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                      active.color === "teal" && "bg-teal/15",
                      active.color === "coral" && "bg-coral/15",
                      active.color === "primary" && "bg-primary/15"
                    )}>
                      <ArrowRight className={cn(
                        "w-3 h-3",
                        active.color === "teal" && "text-teal",
                        active.color === "coral" && "text-coral",
                        active.color === "primary" && "text-primary"
                      )} />
                    </div>
                    <span className="text-foreground text-sm">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
