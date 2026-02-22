import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const beforeItems = [
  "Spreadsheets for scheduling, paper diaries for lessons",
  "Chasing parents for payments via text and email",
  '"What time is the lesson?" messages every week',
  "Manual invoices in Word or Excel",
  "No idea who owes what without checking your notebook",
  "Cancellations = lost revenue, no make-up system",
];

const afterItems = [
  "Drag-and-drop calendar with conflict detection",
  "Automated invoicing with online Stripe payments",
  "Parent portal answers every question 24/7",
  "Bulk invoice generation in clicks, not hours",
  '"Who has outstanding invoices?" — ask LoopAssist',
  "Automatic make-up matching fills cancelled slots",
];

export function BeforeAfter() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 border-destructive/30 text-destructive">
            The Problem
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Sound familiar?
          </h2>
        </div>

        {/* Two columns */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {/* Before */}
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-destructive mb-6">
              Before LessonLoop
            </h3>
            <ul className="space-y-4">
              {beforeItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="flex items-start gap-3 text-muted-foreground"
                >
                  <span className="mt-0.5 shrink-0 text-destructive">✕</span>
                  <motion.span
                    initial={{ textDecorationColor: "transparent" }}
                    whileInView={{ textDecorationColor: "hsl(var(--destructive) / 0.4)" }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 + 0.6, duration: 0.5 }}
                    className="line-through decoration-2"
                  >
                    {item}
                  </motion.span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-primary mb-6">
              With LessonLoop
            </h3>
            <ul className="space-y-4">
              {afterItems.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.08 + 0.3, duration: 0.4 }}
                  className="flex items-start gap-3 text-foreground"
                >
                  <span className="mt-0.5 shrink-0 text-primary">✓</span>
                  <span>{item}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
