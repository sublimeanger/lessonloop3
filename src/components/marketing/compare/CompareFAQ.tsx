import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface FAQ {
  question: string;
  answer: string;
}

interface CompareFAQProps {
  competitorName: string;
  faqs: FAQ[];
}

export default function CompareFAQ({ competitorName, faqs }: CompareFAQProps) {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Common questions about switching from {competitorName} to LessonLoop.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.details
              key={i}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group border border-border/50 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer p-5 text-foreground font-semibold hover:bg-secondary/30 transition-colors">
                {faq.question}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform flex-shrink-0 ml-2" />
              </summary>
              <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                {faq.answer}
              </div>
            </motion.details>
          ))}
        </div>
      </div>
    </section>
  );
}
