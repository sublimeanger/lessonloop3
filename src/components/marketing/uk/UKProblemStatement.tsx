import { motion } from "framer-motion";
import { PoundSterling, Calendar, Shield } from "lucide-react";

const cards = [
  {
    icon: PoundSterling,
    title: "You invoice in pounds. Your software thinks in dollars.",
    body: "Most music school software is built for the US market. That means USD as default, no UK VAT support, and invoices that look foreign to your parents. You end up with workarounds, manual VAT calculations, and a constant nagging feeling that something's not quite right.",
  },
  {
    icon: Calendar,
    title: "Your year runs in terms. Your software doesn't know what a term is.",
    body: "UK music teaching revolves around autumn, spring, and summer terms with half-term breaks. US software uses semesters, quarters, or just continuous scheduling. You end up manually blocking out holidays and hoping you haven't missed one.",
  },
  {
    icon: Shield,
    title: "You need GDPR compliance. Your software offers a checkbox.",
    body: "GDPR isn't optional for UK businesses — it's the law. But most music school software treats it as an afterthought: a privacy policy page and a cookie banner. That's not compliance. You need data export, retention policies, audit logging, and the right to erasure built into the core product.",
  },
];

export function UKProblemStatement() {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Tired of software that doesn't get how UK music teaching works?
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-coral/10 flex items-center justify-center mb-4">
                <card.icon className="w-5 h-5 text-coral" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{card.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
