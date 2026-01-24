import { motion } from "framer-motion";
import { Star, Quote, Music, Piano } from "lucide-react";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    quote: "LessonLoop has transformed how I run my teaching practice. What used to take hours now takes minutes. The parent portal alone has saved me countless emails.",
    author: "Sarah Mitchell",
    role: "Piano Teacher",
    location: "London",
    avatar: "SM",
    instrument: Piano,
    rating: 5,
    featured: true,
  },
  {
    quote: "We manage 15 teachers across 3 locations. Before LessonLoop, coordination was chaos. Now everything just works.",
    author: "James Chen",
    role: "Academy Director",
    location: "Manchester",
    avatar: "JC",
    instrument: Music,
    rating: 5,
  },
  {
    quote: "The invoicing feature has improved our cash flow dramatically. Automatic reminders mean I get paid on time, every time.",
    author: "Emma Thompson",
    role: "Violin Teacher",
    location: "Edinburgh",
    avatar: "ET",
    instrument: Music,
    rating: 5,
  },
  {
    quote: "Finally, a tool built for UK music teachers. VAT handling, term dates, everything just makes sense.",
    author: "David Wilson",
    role: "Guitar Academy",
    location: "Bristol",
    avatar: "DW",
    instrument: Music,
    rating: 5,
  },
  {
    quote: "My students' parents love the portal. They can see upcoming lessons, pay invoices, and message me — all in one place.",
    author: "Rachel Green",
    role: "Voice Coach",
    location: "Cambridge",
    avatar: "RG",
    instrument: Music,
    rating: 5,
  },
  {
    quote: "I was skeptical about switching from my old system, but LessonLoop made the transition seamless. Import was painless.",
    author: "Michael Brown",
    role: "Drum Teacher",
    location: "Leeds",
    avatar: "MB",
    instrument: Music,
    rating: 5,
  },
];

const featuredTestimonial = testimonials.find((t) => t.featured);
const regularTestimonials = testimonials.filter((t) => !t.featured);

export function TestimonialsSection() {
  return (
    <section className="py-24 lg:py-32 bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-gradient-to-r from-teal/5 to-transparent rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-gradient-to-l from-coral/5 to-transparent rounded-full blur-3xl -translate-y-1/2" />

      <div className="container mx-auto px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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

        {/* Featured Testimonial */}
        {featuredTestimonial && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <div className="relative max-w-4xl mx-auto p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-ink to-ink-light overflow-hidden">
              {/* Decorative */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-coral/10 rounded-full blur-2xl" />
              
              <div className="relative flex flex-col lg:flex-row gap-8 items-start">
                {/* Quote Icon */}
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Quote className="w-8 h-8 text-teal-light" />
                </div>
                
                <div className="flex-1">
                  {/* Rating */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(featuredTestimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-coral text-coral" />
                    ))}
                  </div>
                  
                  {/* Quote */}
                  <p className="text-xl lg:text-2xl text-white leading-relaxed mb-8">
                    "{featuredTestimonial.quote}"
                  </p>
                  
                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center text-white font-bold text-lg">
                      {featuredTestimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-lg">
                        {featuredTestimonial.author}
                      </div>
                      <div className="text-white/60">
                        {featuredTestimonial.role} • {featuredTestimonial.location}
                      </div>
                    </div>
                    <div className="ml-auto hidden sm:block">
                      <featuredTestimonial.instrument className="w-8 h-8 text-white/20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Masonry Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {regularTestimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={cn(
                "group relative",
                index === 0 && "lg:row-span-1",
              )}
            >
              <div className="h-full p-6 lg:p-8 rounded-3xl bg-card border border-border hover:border-primary/20 hover:shadow-xl transition-all duration-500">
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
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">
                      {testimonial.author}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role} • {testimonial.location}
                    </div>
                  </div>
                  <testimonial.instrument className="w-5 h-5 text-muted-foreground/30" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
