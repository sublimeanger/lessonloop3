import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const beforeItems = [
  "Spreadsheets for scheduling, paper diaries for lessons",
  "Chasing parents for payments via text and email",
  "'What time is the lesson?' messages every week",
  "Manual invoices in Word or Excel",
  "No idea who owes what without checking a notebook",
  "Cancellations = lost revenue, no make-up system",
];

const afterItems = [
  "Drag-and-drop calendar with conflict detection",
  "Automated invoicing with online Stripe payments",
  "Parent portal answers every question 24/7",
  "Bulk invoice generation in clicks, not hours",
  "'Who has outstanding invoices?' — just ask LoopAssist",
  "Automatic make-up matching fills cancelled slots",
];

export function BeforeAfter() {
  const isMobile = useIsMobile();

  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-6 lg:px-8 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-coral/10 text-coral text-sm font-semibold mb-4">
            The Problem
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Sound familiar?
          </h2>
        </motion.div>

        {/* Two columns */}
        <div className="grid lg:grid-cols-2 gap-0">
          {/* Before */}
          <div className="lg:border-r lg:border-dashed lg:border-border lg:pr-10">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex items-center gap-2 mb-6"
            >
              <X className="w-5 h-5 text-destructive/80" />
              <h3 className="text-lg font-semibold text-destructive/80">
                Before LessonLoop
              </h3>
            </motion.div>

            <div className="space-y-4">
              {beforeItems.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: isMobile ? 0 : -10, y: isMobile ? 10 : 0 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="w-3.5 h-3.5 text-destructive/70" />
                  </div>
                  <span className="text-sm text-muted-foreground">{item}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Mobile divider */}
          <div className="border-t border-dashed border-border my-8 lg:hidden" />

          {/* After */}
          <div className="lg:pl-10">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: isMobile ? 0 : 0.3 }}
              className="flex items-center gap-2 mb-6"
            >
              <Check className="w-5 h-5 text-teal" />
              <h3 className="text-lg font-semibold text-teal">
                With LessonLoop
              </h3>
            </motion.div>

            <div className="space-y-4">
              {afterItems.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: isMobile ? 0 : 10, y: isMobile ? 10 : 0 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (isMobile ? 0 : 0.3) + i * 0.08, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-teal" />
                  </div>
                  <span className="text-sm text-foreground">{item}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
