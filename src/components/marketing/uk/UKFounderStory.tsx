import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { Link } from "react-router-dom";

export function UKFounderStory() {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <Quote className="w-12 h-12 text-primary/20 mx-auto mb-6" />
          <blockquote className="text-lg lg:text-xl italic text-muted-foreground leading-relaxed">
            "I taught piano in Surrey for twenty years. Every piece of software I tried was American — and it showed.
            Invoices in dollars, no understanding of terms, and 'GDPR compliance' that amounted to a privacy policy
            page. I built LessonLoop because UK music teachers deserve software that works the way we actually teach."
          </blockquote>

          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-teal-dark flex items-center justify-center text-white font-bold text-sm">
              LT
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Lauren Twilley</p>
              <p className="text-sm text-muted-foreground">Founder & Piano Teacher · Hersham, Surrey</p>
            </div>
          </div>

          <Link to="/about" className="inline-block mt-6 text-sm font-semibold text-primary hover:underline">
            Read our full story →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
