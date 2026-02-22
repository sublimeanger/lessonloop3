import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const ukFeatures = [
  { emoji: "🇬🇧", title: "GBP & Pence", desc: "No currency conversion headaches" },
  { emoji: "📋", title: "UK VAT", desc: "Calculated and displayed automatically" },
  { emoji: "🏫", title: "Term Dates", desc: "Configure your own term structure" },
  { emoji: "🎄", title: "Bank Holidays", desc: "Auto-skip UK public holidays" },
  { emoji: "🔒", title: "GDPR", desc: "Compliant by design, UK data residency" },
  { emoji: "⏰", title: "UK Time Zones", desc: "No confusing UTC offsets" },
];

export function UKDifferentiator() {
  return (
    <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Subtle accent gradient */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-600/3 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-red-600/3 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <Badge variant="outline" className="mb-5 border-primary/30 text-primary">
            Built for the UK
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Finally, software that understands
            <br className="hidden md:block" />
            {" "}UK music teaching.
          </h2>
        </motion.div>

        {/* 2x3 Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {ukFeatures.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="flex items-start gap-4 p-5 rounded-2xl border border-border bg-card"
            >
              <span className="text-2xl shrink-0 mt-0.5">{feat.emoji}</span>
              <div>
                <p className="font-semibold text-foreground">{feat.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{feat.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Founder quote */}
        <motion.blockquote
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto mt-14 text-center"
        >
          <p className="text-lg italic text-muted-foreground leading-relaxed">
            "Most music school software is built in North America and retrofitted for the UK.
            LessonLoop was built here, for here."
          </p>
          <footer className="mt-4 text-sm font-semibold text-foreground">
            — Lauren Twilley, Founder
          </footer>
        </motion.blockquote>
      </div>
    </section>
  );
}
