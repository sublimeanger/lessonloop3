import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote: "LessonLoop has transformed how I run my teaching practice. What used to take hours now takes minutes. The parent portal alone has saved me countless emails.",
    author: "Sarah Mitchell",
    role: "Piano Teacher, London",
    avatar: "SM",
    rating: 5,
  },
  {
    quote: "We manage 15 teachers across 3 locations. Before LessonLoop, coordination was chaos. Now everything just works. The AI assistant is genuinely helpful.",
    author: "James Chen",
    role: "Academy Director, Manchester",
    avatar: "JC",
    rating: 5,
  },
  {
    quote: "The invoicing feature has improved our cash flow dramatically. Automatic reminders mean I get paid on time, every time. Can't imagine going back to spreadsheets.",
    author: "Emma Thompson",
    role: "Violin Teacher, Edinburgh",
    avatar: "ET",
    rating: 5,
  },
  {
    quote: "Finally, a tool built for UK music teachers. VAT handling, term dates, everything just makes sense. The support team is incredible too.",
    author: "David Wilson",
    role: "Guitar Academy, Bristol",
    avatar: "DW",
    rating: 5,
  },
  {
    quote: "My students' parents love the portal. They can see upcoming lessons, pay invoices, and message me — all in one place. Professional and easy.",
    author: "Rachel Green",
    role: "Voice Coach, Cambridge",
    avatar: "RG",
    rating: 5,
  },
  {
    quote: "I was skeptical about switching from my old system, but LessonLoop made the transition seamless. Import was painless and support was fantastic.",
    author: "Michael Brown",
    role: "Drum Teacher, Leeds",
    avatar: "MB",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 lg:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-coral/10 text-coral text-sm font-semibold mb-6">
            Testimonials
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Loved by educators
            <br />
            <span className="text-muted-foreground">across the UK</span>
          </h2>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group"
            >
              <div className="h-full p-8 rounded-3xl bg-card border border-border hover:border-primary/20 hover:shadow-xl transition-all duration-500">
                {/* Quote Icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Quote className="w-5 h-5 text-primary" />
                </div>

                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-coral text-coral" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-foreground/80 leading-relaxed mb-8">
                  "{testimonial.quote}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-4 pt-6 border-t border-border">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center text-white font-bold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">
                      {testimonial.author}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
