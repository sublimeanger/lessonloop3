import { motion } from "framer-motion";
import { Quote } from "lucide-react";

interface UseCaseTestimonialProps {
  quote: string;
  author: string;
  role: string;
}

export default function UseCaseTestimonial({ quote, author, role }: UseCaseTestimonialProps) {
  return (
    <section className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-6 lg:px-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Quote className="w-10 h-10 text-primary/30 mx-auto mb-6" />
          <blockquote className="text-xl lg:text-2xl font-medium text-foreground italic leading-relaxed">
            "{quote}"
          </blockquote>
          <div className="mt-6">
            <p className="font-semibold text-foreground">{author}</p>
            <p className="text-sm text-muted-foreground">{role}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
