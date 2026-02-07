import { motion } from "framer-motion";
import { Quote, Calendar, Receipt, MessageSquare, Users, Repeat } from "lucide-react";

const painPoints = [
  {
    icon: Calendar,
    problem: "Juggling spreadsheets and calendars",
    solution: "One calendar that handles recurring lessons, term dates, and room bookings — with drag-and-drop ease.",
  },
  {
    icon: Receipt,
    problem: "Chasing payments and manual invoicing",
    solution: "Automated billing runs, professional invoices, and payment tracking built for GBP and UK VAT.",
  },
  {
    icon: MessageSquare,
    problem: "Endless emails and missed messages",
    solution: "Built-in parent communication with a dedicated portal. No more chasing — parents stay in the loop.",
  },
  {
    icon: Repeat,
    problem: "Rescheduling chaos and double-bookings",
    solution: "Conflict detection, make-up credits, and rescheduling tools that protect your time.",
  },
  {
    icon: Users,
    problem: "Outgrowing your current system",
    solution: "Scales from solo teacher to multi-location academy. Add teachers, locations, and rooms as you grow.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-gradient-to-r from-teal/5 to-transparent rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-gradient-to-l from-coral/5 to-transparent rounded-full blur-3xl -translate-y-1/2" />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-coral/10 text-coral text-sm font-semibold mb-6">
            Why LessonLoop?
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Built to solve real
            <br />
            <span className="text-muted-foreground">teaching problems</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Every feature in LessonLoop exists because a music teacher — our founder — experienced the problem firsthand.
          </p>
        </motion.div>

        {/* Featured Founder Quote */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="relative max-w-4xl mx-auto p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-ink to-ink-light overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-coral/10 rounded-full blur-2xl" />
            
            <div className="relative flex flex-col lg:flex-row gap-8 items-start">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Quote className="w-8 h-8 text-teal-light" />
              </div>
              
              <div className="flex-1">
                <p className="text-xl lg:text-2xl text-white leading-relaxed mb-8">
                  "Behind the lessons, I lived the side of teaching that no one talks about enough: the constant admin. The back-and-forth. The chasing. I built LessonLoop so other teachers wouldn't have to."
                </p>
                
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center text-white font-bold text-lg">
                    LT
                  </div>
                  <div>
                    <div className="font-semibold text-white text-lg">
                      Lauren Twilley
                    </div>
                    <div className="text-white/60">
                      Founder · Piano Teacher · 20 Years in Music Education
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Pain Points Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {painPoints.map((point, index) => (
            <motion.div
              key={point.problem}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group relative"
            >
              <div className="h-full p-6 lg:p-8 rounded-3xl bg-card border border-border hover:border-primary/20 hover:shadow-xl transition-all duration-500">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <point.icon className="w-6 h-6 text-primary" />
                </div>

                <p className="text-sm font-medium text-coral mb-2">
                  The problem
                </p>
                <p className="text-foreground font-semibold mb-4">
                  {point.problem}
                </p>

                <p className="text-sm font-medium text-teal mb-2">
                  The solution
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {point.solution}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
