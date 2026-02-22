import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { Link } from "react-router-dom";

export function FounderStory() {
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
            Our Story
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Built to solve real
            <br />
            <span className="text-muted-foreground">teaching problems</span>
          </h2>
        </motion.div>

        {/* Founder Quote Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="relative max-w-4xl mx-auto p-8 lg:p-12 rounded-3xl bg-gradient-to-br from-ink to-ink-light overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-coral/10 rounded-full blur-2xl" />
            
            <div className="relative flex flex-col lg:flex-row gap-8 items-start">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Quote className="w-8 h-8 text-teal-light" />
              </div>
              
              <div className="flex-1">
                <p className="text-xl lg:text-2xl text-white leading-relaxed mb-8">
                  "Behind the lessons, I lived the side of teaching that no one talks about enough: the constant admin. The back-and-forth. The chasing. I built LessonLoop so other teachers wouldn't have to."
                </p>
                
                <div className="flex items-center gap-4">
                  {/* Photo placeholder with gradient ring */}
                  <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-teal to-coral shrink-0">
                    <div className="w-full h-full rounded-full bg-ink-light flex items-center justify-center text-white font-bold text-lg">
                      LT
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-lg">
                      Lauren Twilley
                    </div>
                    <div className="text-white/60">
                      Founder · Piano Teacher · 20 Years in Music Education
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Journey paragraph + link */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mt-10"
        >
          <p className="text-muted-foreground leading-relaxed">
            Lauren Twilley spent 20 years as a piano teacher before building LessonLoop. Every feature exists because she lived the problem firsthand.
          </p>
          <Link
            to="/about"
            className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-primary hover:gap-2.5 transition-all"
          >
            Read our full story →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
