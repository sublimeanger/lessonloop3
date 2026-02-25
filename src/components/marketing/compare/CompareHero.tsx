import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

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
    <section className="relative py-24 lg:py-36 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-teal/5 pointer-events-none" />

      <div className="container relative mx-auto px-6 lg:px-8 text-center max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-3 mb-6">
            <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              {badgeLeft}
            </span>
            <span className="text-muted-foreground text-sm font-medium">vs</span>
            <span className="px-4 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-semibold">
              {badgeRight || competitorName}
            </span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight"
        >
          {headline}{" "}
          <span className="bg-gradient-to-r from-primary to-teal-dark bg-clip-text text-transparent">
            {headlineAccent}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button size="lg" asChild>
            <Link to="/signup">
              Start free trial <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/pricing">View pricing</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
