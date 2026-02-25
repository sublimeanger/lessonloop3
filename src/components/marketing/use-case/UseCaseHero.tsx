import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface UseCaseHeroProps {
  badge: string;
  badgeIcon?: LucideIcon;
  title: string;
  titleAccent: string;
  subtitle: string;
  primaryCTA?: { label: string; to: string };
  secondaryCTA?: { label: string; to: string };
}

export default function UseCaseHero({
  badge,
  badgeIcon: BadgeIcon,
  title,
  titleAccent,
  subtitle,
  primaryCTA = { label: "Start free trial", to: "/signup" },
  secondaryCTA = { label: "View pricing", to: "/pricing" },
}: UseCaseHeroProps) {
  return (
    <section className="relative pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-teal/5 pointer-events-none" />

      <div className="container relative mx-auto px-5 sm:px-6 lg:px-8 text-center max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-6">
            {BadgeIcon && <BadgeIcon className="w-4 h-4" />}
            {badge}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] tracking-tight"
        >
          {title}{" "}
          <span className="bg-gradient-to-r from-primary to-teal-dark bg-clip-text text-transparent">
            {titleAccent}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Button size="lg" asChild>
            <Link to={primaryCTA.to}>
              {primaryCTA.label} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to={secondaryCTA.to}>{secondaryCTA.label}</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
