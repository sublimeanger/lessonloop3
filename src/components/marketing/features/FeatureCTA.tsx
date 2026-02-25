import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

export function FeatureCTA() {
  return (
    <section className="py-24 lg:py-36 relative overflow-hidden bg-background">
      {/* Gradient accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-teal/5 via-transparent to-coral/5 blur-3xl" />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center mx-auto mb-8 shadow-lg shadow-teal/20"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>

          <h2 className="text-3xl lg:text-5xl font-bold text-foreground mb-6">
            Ready to get your
            <br />
            <span className="bg-gradient-to-r from-teal to-teal-light bg-clip-text text-transparent">evenings back?</span>
          </h2>

          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Join a growing community of music educators who've reclaimed their time. 
            Start your 30-day free trial today.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-teal text-white font-semibold text-lg shadow-lg shadow-teal/20 hover:shadow-xl hover:shadow-teal/30 transition-all hover:scale-[1.02]"
            >
              Start free trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-border text-foreground font-medium hover:bg-muted transition-colors"
            >
              Book a demo
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            {["30-day free trial", "No credit card required", "Cancel anytime"].map((text) => (
              <div key={text} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-success" />
                </div>
                {text}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
