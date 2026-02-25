import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface Differentiator {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface CompareDifferentiatorsProps {
  competitorName: string;
  headline?: string;
  subtitle?: string;
  items: Differentiator[];
}

export default function CompareDifferentiators({
  competitorName,
  headline,
  subtitle,
  items,
}: CompareDifferentiatorsProps) {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-6 lg:px-8 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 lg:mb-14"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs lg:text-sm font-semibold mb-4">
            Why LessonLoop
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
            {headline || `What sets LessonLoop apart from ${competitorName}`}
          </h2>
          {subtitle && <p className="text-sm lg:text-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-border rounded-xl p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
