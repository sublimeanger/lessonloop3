import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

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

const ACCENT_CYCLE = ["teal", "coral", "violet", "emerald"] as const;

const ACCENT_MAP: Record<string, { icon: string; bg: string; border: string }> = {
  teal: { icon: "text-[hsl(var(--teal))]", bg: "bg-[hsl(var(--teal)/0.1)]", border: "border-l-[hsl(var(--teal))]" },
  coral: { icon: "text-[hsl(var(--coral))]", bg: "bg-[hsl(var(--coral)/0.1)]", border: "border-l-[hsl(var(--coral))]" },
  violet: { icon: "text-[hsl(var(--violet))]", bg: "bg-[hsl(var(--violet)/0.1)]", border: "border-l-[hsl(var(--violet))]" },
  emerald: { icon: "text-[hsl(var(--emerald))]", bg: "bg-[hsl(var(--emerald)/0.1)]", border: "border-l-[hsl(var(--emerald))]" },
};

export default function CompareDifferentiators({
  competitorName,
  headline,
  subtitle,
  items,
}: CompareDifferentiatorsProps) {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 lg:mb-16"
        >
          <p className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-4">Why LessonLoop</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3">
            {headline || `What sets LessonLoop apart from ${competitorName}`}
          </h2>
          {subtitle && <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => {
            const Icon = item.icon;
            const accent = ACCENT_MAP[ACCENT_CYCLE[i % ACCENT_CYCLE.length]];
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className={`p-6 rounded-2xl border-l-4 ${accent.border} border border-border/30 bg-card hover:shadow-lg transition-shadow duration-300`}
              >
                <div className={`w-10 h-10 rounded-xl ${accent.bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${accent.icon}`} />
                </div>
                <h3 className="font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
