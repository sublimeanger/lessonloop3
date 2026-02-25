import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface CompareCTAProps {
  competitorName: string;
  headline?: string;
  headlineAccent?: string;
  subtitle?: string;
  otherComparisons?: { label: string; to: string }[];
}

const trustItems = ["No credit card required", "30-day free trial", "Cancel anytime", "UK-headquartered"];

export default function CompareCTA({
  competitorName,
  headline,
  headlineAccent,
  subtitle,
  otherComparisons = [],
}: CompareCTAProps) {
  return (
    <section className="relative py-20 lg:py-28 bg-[hsl(var(--ink))] overflow-hidden">
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-20 blur-3xl"
        style={{ background: "radial-gradient(ellipse, hsl(var(--teal)) 0%, transparent 70%)" }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            {headline || `Ready to switch from ${competitorName}?`}{" "}
            {headlineAccent && (
              <span className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-light,var(--teal)))] bg-clip-text text-transparent">
                {headlineAccent}
              </span>
            )}
          </h2>
          <p className="mt-4 text-lg text-white/60">
            {subtitle || "Start your 30-day free trial. No credit card required. Cancel anytime."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            Start free trial <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
          >
            View plans and pricing
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap justify-center items-center gap-x-2 text-sm text-white/50"
        >
          {trustItems.map((item, i) => (
            <span key={item} className="flex items-center">
              {i > 0 && <span className="mx-2">·</span>}
              {item}
            </span>
          ))}
        </motion.div>

        {otherComparisons.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-12 pt-8 border-t border-white/10"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 mb-5">Other comparisons</p>
            <div className="flex flex-wrap justify-center gap-3">
              {otherComparisons.map((comp) => (
                <Link
                  key={comp.to}
                  to={comp.to}
                  className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
                >
                  {comp.label} →
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
