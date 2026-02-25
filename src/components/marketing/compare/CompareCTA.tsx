import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface CompareCTAProps {
  competitorName: string;
  headline?: string;
  headlineAccent?: string;
  subtitle?: string;
  otherComparisons?: { label: string; to: string }[];
}

export default function CompareCTA({
  competitorName,
  headline,
  headlineAccent,
  subtitle,
  otherComparisons = [],
}: CompareCTAProps) {
  return (
    <section className="py-24 lg:py-32 bg-ink">
      <div className="container mx-auto px-6 lg:px-8 text-center max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl lg:text-4xl font-bold text-white">
            {headline || `Ready to switch from ${competitorName}?`}{" "}
            {headlineAccent && (
              <span className="bg-gradient-to-r from-primary to-teal-light bg-clip-text text-transparent">
                {headlineAccent}
              </span>
            )}
          </h2>
          <p className="mt-4 text-lg text-white/70">
            {subtitle || "Start your 30-day free trial. No credit card required. Cancel anytime."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button size="lg" className="bg-white text-ink hover:bg-white/90" asChild>
            <Link to="/signup">
              Start free trial <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
            <Link to="/pricing">View plans and pricing</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap justify-center items-center gap-x-2 text-sm text-white/50"
        >
          <span>No credit card required</span>
          <span className="mx-2">·</span>
          <span>30-day free trial</span>
          <span className="mx-2">·</span>
          <span>Cancel anytime</span>
        </motion.div>

        {otherComparisons.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-10 pt-8 border-t border-white/10"
          >
            <p className="text-sm text-white/40 mb-4">Other comparisons</p>
            <div className="flex flex-wrap justify-center gap-4">
              {otherComparisons.map((comp) => (
                <Link
                  key={comp.to}
                  to={comp.to}
                  className="text-sm font-medium text-white/60 hover:text-white transition-colors"
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
