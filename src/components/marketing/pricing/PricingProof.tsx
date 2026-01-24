import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote: "LessonLoop saves me at least 5 hours every week on admin. Game changer!",
    author: "Sarah M.",
    role: "Piano Teacher, London",
    avatar: "SM",
  },
  {
    quote: "The invoicing automation alone pays for the subscription ten times over.",
    author: "James K.",
    role: "Academy Owner, Manchester",
    avatar: "JK",
  },
  {
    quote: "Finally, a system that understands how music teachers actually work.",
    author: "Emma L.",
    role: "Violin Teacher, Edinburgh",
    avatar: "EL",
  },
];

export function PricingProof() {
  return (
    <section className="py-16 lg:py-20 border-y border-border bg-muted/20">
      <div className="container mx-auto px-6 lg:px-8">
        {/* Trust header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-lg text-muted-foreground">
            Trusted by <span className="font-semibold text-foreground">2,000+</span> music educators across the UK
          </p>
        </motion.div>
        
        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative bg-card border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-lg transition-all"
            >
              <Quote className="w-8 h-8 text-primary/20 mb-4" />
              
              <p className="text-foreground mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal to-primary flex items-center justify-center text-white font-semibold text-sm">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {testimonial.author}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
