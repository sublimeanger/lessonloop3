import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Play, Star, Sparkles, Calendar, Receipt, MessageSquare } from "lucide-react";

const floatingElements = [
  { icon: Calendar, label: "Easy Scheduling", delay: 0, position: "left-[8%] top-[30%]" },
  { icon: Receipt, label: "Auto Invoicing", delay: 0.2, position: "right-[10%] top-[35%]" },
  { icon: MessageSquare, label: "Parent Portal", delay: 0.4, position: "left-[5%] bottom-[30%]" },
  { icon: Sparkles, label: "AI Assistant", delay: 0.6, position: "right-[8%] bottom-[35%]" },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Animated Gradient Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-teal/20 rounded-full blur-[120px]"
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-coral/15 rounded-full blur-[100px]"
      />

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating Feature Cards (Desktop Only) */}
      <div className="absolute inset-0 hidden lg:block pointer-events-none">
        {floatingElements.map((el, i) => (
          <motion.div
            key={el.label}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.8 + el.delay, duration: 0.6 }}
            className={`absolute ${el.position}`}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-3 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal to-teal-dark flex items-center justify-center">
                  <el.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-medium text-sm">{el.label}</span>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 lg:px-8 relative z-10 pt-20">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-r from-teal to-teal-light">
              <Star className="w-3 h-3 text-white" />
            </span>
            <span className="text-white/90 text-sm font-medium">
              Trusted by 2,000+ music educators across the UK
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-white leading-[0.95] tracking-tight"
          >
            Music lessons,
            <br />
            <span className="relative">
              <span className="relative z-10 gradient-text-teal">perfectly</span>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="absolute left-0 bottom-2 w-full h-3 bg-teal/30 -rotate-1 origin-left z-0"
              />
            </span>
            {" "}orchestrated
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 text-xl sm:text-2xl text-white/70 max-w-2xl mx-auto leading-relaxed"
          >
            The all-in-one platform for music teachers and academies. 
            Scheduling, invoicing, and communication — beautifully simple.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/signup">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  size="xl" 
                  className="bg-white text-ink hover:bg-white/90 font-bold shadow-2xl shadow-black/20 px-8"
                >
                  Start Free Trial
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </motion.div>
            </Link>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 px-6 py-3.5 text-white/90 hover:text-white font-medium transition-colors group"
            >
              <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 group-hover:bg-white/20 transition-colors">
                <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
              </span>
              Watch Demo
            </motion.button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8 text-white/50"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-light to-teal border-2 border-ink flex items-center justify-center text-xs font-bold text-ink"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span className="text-sm">2,000+ educators</span>
            </div>
            <div className="w-px h-6 bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 fill-coral text-coral" />
              ))}
              <span className="text-sm ml-1">4.9/5 rating</span>
            </div>
            <div className="w-px h-6 bg-white/20 hidden sm:block" />
            <span className="text-sm">No credit card required</span>
          </motion.div>
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
