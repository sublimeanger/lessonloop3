import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";

interface CompareHeroProps {
  competitorName: string;
  headline: string;
  headlineAccent: string;
  subtitle: string;
  badgeLeft?: string;
  badgeRight?: string;
}

export default function CompareHero({
  competitorName,
  headline,
  headlineAccent,
  subtitle,
  badgeLeft = "LessonLoop",
  badgeRight,
}: CompareHeroProps) {
  return (
    <section className="relative pt-24 pb-14 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }} />
      <motion.div
        className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)" }}
      />
      <motion.div
        className="absolute -bottom-20 -left-40 w-[400px] h-[400px] rounded-full opacity-8"
        style={{ background: "radial-gradient(circle, hsl(var(--coral)) 0%, transparent 70%)" }}
      />

      <div className="container relative mx-auto px-5 sm:px-6 lg:px-8 text-center max-w-4xl">
        {/* VS Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-3 mb-8"
        >
          <span className="px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold tracking-wide">
            {badgeLeft}
          </span>
          <span className="w-9 h-9 rounded-full bg-[hsl(var(--ink))] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </span>
          <span className="px-4 py-2.5 rounded-xl bg-muted border border-border/60 text-muted-foreground text-sm font-bold tracking-wide">
            {badgeRight || competitorName}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl sm:text-4xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight"
        >
          {headline}{" "}
          <span className="bg-gradient-to-r from-[hsl(var(--teal))] to-[hsl(var(--teal-dark))] bg-clip-text text-transparent">
            {headlineAccent}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
          >
            Start free trial <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl border border-border text-foreground font-medium hover:bg-secondary transition-colors"
          >
            View plans and pricing
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
