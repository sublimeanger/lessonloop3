import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface FeaturePageCTAProps {
  headline: string;
  headlineAccent?: string;
  subtitle: string;
  primaryCTA?: { label: string; to: string };
  secondaryCTA?: { label: string; to: string };
  trustItems?: string[];
}

export default function FeaturePageCTA({
  headline,
  headlineAccent,
  subtitle,
  primaryCTA = { label: "Start your free trial", to: "/signup" },
  secondaryCTA = { label: "View plans and pricing", to: "/pricing" },
  trustItems = ["No credit card required", "30-day free trial", "Cancel anytime"],
}: FeaturePageCTAProps) {
  return (
    <section className="py-24 lg:py-32 bg-ink">
      <div className="container mx-auto px-6 lg:px-8 text-center max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl lg:text-4xl font-bold text-white">
            {headline}{" "}
            {headlineAccent && (
              <span className="bg-gradient-to-r from-primary to-teal-light bg-clip-text text-transparent">
                {headlineAccent}
              </span>
            )}
          </h2>
          <p className="mt-4 text-lg text-white/70">{subtitle}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button size="lg" className="bg-white text-ink hover:bg-white/90" asChild>
            <Link to={primaryCTA.to}>
              {primaryCTA.label} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
            <Link to={secondaryCTA.to}>{secondaryCTA.label}</Link>
          </Button>
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
      </div>
    </section>
  );
}
