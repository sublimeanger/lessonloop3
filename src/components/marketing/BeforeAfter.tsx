import { motion } from "framer-motion";
import { X, Check, ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const beforeItems = [
  "Spreadsheets for scheduling, paper diaries for lessons",
  "Chasing parents for payments via text and email",
  "'What time is the lesson?' messages every week",
  "Printing invoices or using generic accounting software",
  "No idea who owes what without checking a notebook",
  "Cancellations = lost revenue, no make-up system",
  "No way to track student practice between lessons",
];

const afterItems = [
  { text: "Drag-and-drop calendar with conflict detection", link: "/features/scheduling" },
  { text: "Automated invoicing with online Stripe payments", link: "/features/billing" },
  { text: "Parent portal answers every question 24/7", link: "/features/parent-portal" },
  { text: "Termly billing runs with payment plans & installments", link: "/features/billing" },
  { text: "'Who has outstanding invoices?' — just ask LoopAssist", link: "/features/loopassist" },
  { text: "Automatic make-up matching fills cancelled slots", link: "/features/scheduling" },
  { text: "Practice assignments with streak tracking", link: "/features/practice-tracking" },
  { text: "Resource library for sharing materials with families", link: "/features/resources" },
];

export function BeforeAfter() {
  const isMobile = useIsMobile();

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      {/* Split background — destructive-tinted left, teal-tinted right */}
      <div className="absolute inset-0 flex">
        <div className="w-full lg:w-1/2 bg-background" />
        <div className="hidden lg:block w-1/2 bg-[hsl(var(--ink))]" />
      </div>

      {/* Subtle center glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.04] pointer-events-none hidden lg:block"
        style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)", filter: "blur(100px)" }}
      />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 lg:mb-20"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[hsl(var(--coral)/0.1)] border border-[hsl(var(--coral)/0.15)] text-[hsl(var(--coral))] text-sm font-semibold mb-6"
          >
            <Zap className="w-3.5 h-3.5" />
            The Transformation
          </motion.span>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            From chaos to clarity
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            See how music educators across the UK are reclaiming their evenings.
          </p>
        </motion.div>

        {/* Two columns */}
        <div className="grid lg:grid-cols-2 gap-0 max-w-6xl mx-auto">
          {/* BEFORE — light background */}
          <motion.div
            initial={{ opacity: 0, x: isMobile ? 0 : -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative p-8 lg:p-10 lg:pr-12"
          >
            {/* Strikethrough decoration */}
            <div className="absolute top-8 right-8 lg:right-12 w-16 h-16 opacity-[0.04] pointer-events-none">
              <X className="w-full h-full text-destructive" strokeWidth={1} />
            </div>

            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Before LessonLoop</h3>
                <p className="text-xs text-muted-foreground">The daily grind</p>
              </div>
            </div>

            <div className="space-y-4">
              {beforeItems.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.35 }}
                  className="flex items-start gap-3 group"
                >
                  <div className="w-5 h-5 rounded-full bg-destructive/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-destructive/60" />
                  </div>
                  <span className="text-sm text-muted-foreground leading-relaxed line-through decoration-destructive/20 decoration-1">
                    {item}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Mobile divider */}
          <div className="lg:hidden">
            <div className="relative py-6 flex items-center justify-center">
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                className="relative z-10 w-10 h-10 rounded-full bg-[hsl(var(--teal))] flex items-center justify-center shadow-lg"
              >
                <ArrowRight className="w-4 h-4 text-white rotate-90" />
              </motion.div>
            </div>
          </div>

          {/* AFTER — dark background */}
          <motion.div
            initial={{ opacity: 0, x: isMobile ? 0 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: isMobile ? 0 : 0.15 }}
            className="relative p-8 lg:p-10 lg:pl-12 bg-[hsl(var(--ink))] rounded-2xl lg:rounded-none lg:rounded-r-3xl"
          >
            {/* Corner glow */}
            <div className="absolute top-0 right-0 w-40 h-40 opacity-[0.08] pointer-events-none" style={{ background: "radial-gradient(circle, hsl(var(--teal)) 0%, transparent 70%)" }} />

            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--teal)/0.15)] flex items-center justify-center">
                <Check className="w-5 h-5 text-[hsl(var(--teal-light))]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">With LessonLoop</h3>
                <p className="text-xs text-white/40">Everything in one place</p>
              </div>
            </div>

            <div className="space-y-4">
              {afterItems.map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (isMobile ? 0 : 0.15) + i * 0.06, duration: 0.35 }}
                  className="flex items-start gap-3 group"
                >
                  <div className="w-5 h-5 rounded-full bg-[hsl(var(--teal)/0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-[hsl(var(--teal-light))]" />
                  </div>
                  <Link
                    to={item.link}
                    className="text-sm text-white/70 leading-relaxed group-hover:text-white transition-colors"
                  >
                    {item.text}
                    <ArrowRight className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Bottom stat */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="mt-8 pt-6 border-t border-white/[0.06] flex items-center gap-4"
            >
              <div className="text-3xl font-bold bg-gradient-to-r from-[hsl(var(--teal-light))] to-[hsl(var(--teal))] bg-clip-text text-transparent">
                5hrs+
              </div>
              <p className="text-sm text-white/40 leading-snug">
                saved per week on average
                <br />
                by UK music educators
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
