import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const trustItems = ["🇬🇧 UK-headquartered", "£ GBP native", "GDPR by design", "30-day free trial"];

export function UKHero() {
  return (
    <section className="relative py-24 lg:py-36 overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-coral/5 pointer-events-none" />
      {/* Faint Union Jack accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.03] pointer-events-none select-none text-[400px] leading-none text-center">
        🇬🇧
      </div>

      <div className="container relative mx-auto px-6 lg:px-8 text-center max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            🇬🇧 Built in the UK, for the UK
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight"
        >
          Music school software that actually{" "}
          <span className="bg-gradient-to-r from-primary to-teal-dark bg-clip-text text-transparent">
            understands the UK
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          Every other option is American or Canadian. LessonLoop is the only music school management software built
          natively for UK educators — with GBP billing, UK VAT, termly scheduling, and GDPR compliance baked in from day
          one.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button size="lg" asChild>
            <Link to="/signup">
              Start your free trial <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/features">See all features</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-10 flex flex-wrap justify-center items-center gap-x-2 text-sm text-muted-foreground"
        >
          {trustItems.map((item, i) => (
            <span key={item} className="flex items-center">
              {i > 0 && <span className="mx-2 text-border">·</span>}
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
