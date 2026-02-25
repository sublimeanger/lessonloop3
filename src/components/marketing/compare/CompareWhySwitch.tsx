import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface Reason {
  title: string;
  description: string;
}

interface CompareWhySwitchProps {
  competitorName: string;
  reasons: Reason[];
  migrationNote?: string;
}

export default function CompareWhySwitch({ competitorName, reasons, migrationNote }: CompareWhySwitchProps) {
  return (
    <section className="relative py-16 sm:py-20 lg:py-28 bg-[hsl(var(--ink))] overflow-hidden">
      <motion.div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)" }}
      />

      <div className="container mx-auto px-5 sm:px-6 lg:px-8 max-w-4xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 lg:mb-16"
        >
          <p className="text-sm font-bold tracking-[0.2em] uppercase text-[hsl(var(--teal))] mb-4">Why Switch</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-3">
            Why teachers switch from <span className="text-[hsl(var(--teal))]">{competitorName}</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Real reasons music educators choose LessonLoop.
          </p>
        </motion.div>

        <div className="space-y-4">
          {reasons.map((reason, i) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-4 p-4 sm:p-5 lg:p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--emerald)/0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--emerald))]" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">{reason.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{reason.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {migrationNote && (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 text-center text-sm text-white/40"
          >
            {migrationNote}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 text-center"
        >
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            Start your free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
