import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle } from "lucide-react";

interface Reason {
  title: string;
  description: string;
}

interface CompareWhySwitchProps {
  competitorName: string;
  reasons: Reason[];
  migrationNote?: string;
}

export default function CompareWhySwitch({ competitorName, reasons, migrationNote }: CompareWhySwitchProps) {
  return (
    <section className="py-16 lg:py-24 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 lg:mb-14"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
            Why teachers switch from {competitorName}
          </h2>
          <p className="text-sm lg:text-lg text-muted-foreground max-w-2xl mx-auto">
            Real reasons music educators choose LessonLoop over {competitorName}.
          </p>
        </motion.div>

        <div className="space-y-4 lg:space-y-6">
          {reasons.map((reason, i) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-4 bg-card border border-border rounded-xl p-5 lg:p-6"
            >
              <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-foreground mb-1">{reason.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{reason.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {migrationNote && (
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-8 text-center text-sm text-muted-foreground"
          >
            {migrationNote}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Start your free trial <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
