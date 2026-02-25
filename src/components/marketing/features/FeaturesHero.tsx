import { motion } from "framer-motion";
import { 
  Calendar, 
  Receipt, 
  Users, 
  Sparkles, 
  BarChart3, 
  RefreshCw,
  ChevronDown,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef } from "react";

const categories = [
  { id: "scheduling", label: "Scheduling", icon: Calendar },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "portal", label: "Parent Portal", icon: Users },
  { id: "ai", label: "AI Assistant", icon: Sparkles },
  { id: "makeups", label: "Make-Ups", icon: RefreshCw },
  { id: "more", label: "More", icon: BarChart3 },
];

interface FeaturesHeroProps {
  activeCategory: string;
  onCategoryClick: (id: string) => void;
}

export function FeaturesHero({ activeCategory, onCategoryClick }: FeaturesHeroProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (id: string) => {
    onCategoryClick(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="relative min-h-[70vh] lg:min-h-[85vh] flex flex-col items-center justify-center overflow-hidden pt-24 lg:pt-28">
      {/* Layered background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[hsl(var(--ink))]" />
        
        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-[10%] -left-20 w-[500px] lg:w-[700px] h-[500px] lg:h-[700px] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, hsl(var(--teal) / 0.4) 0%, transparent 60%)",
          }}
          animate={{
            x: [0, 60, 0],
            y: [0, -40, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[10%] -right-20 w-[400px] lg:w-[600px] h-[400px] lg:h-[600px] rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, hsl(var(--coral) / 0.35) 0%, transparent 60%)",
          }}
          animate={{
            x: [0, -50, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Noise texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--teal) / 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(var(--teal) / 0.5) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Floating UI elements - Desktop only */}
      <motion.div
        className="absolute top-[15%] left-[8%] hidden xl:block"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        <motion.div
          className="bg-white/[0.07] backdrop-blur-xl border border-white/[0.1] rounded-xl p-3 shadow-2xl"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-teal" />
            </div>
            <div>
              <p className="text-xs text-white/50">Lesson scheduled</p>
              <p className="text-sm font-medium text-white/90">Today, 3:00 PM</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute top-[20%] right-[8%] hidden xl:block"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
      >
        <motion.div
          className="bg-white/[0.07] backdrop-blur-xl border border-white/[0.1] rounded-xl p-3 shadow-2xl"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/20 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-white/50">Payment received</p>
              <p className="text-sm font-medium text-success">£45.00</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute bottom-[30%] left-[10%] hidden xl:block"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <motion.div
          className="bg-white/[0.07] backdrop-blur-xl border border-white/[0.1] rounded-xl p-3 shadow-2xl"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-coral/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-coral" />
            </div>
            <div>
              <p className="text-xs text-white/50">LoopAssist</p>
              <p className="text-sm font-medium text-white/90">3 invoices ready</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 lg:mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] border border-white/[0.1] backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5 text-teal" />
            <span className="text-xs font-medium text-white/70 tracking-wide uppercase">50+ Features · All Plans</span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-3xl sm:text-5xl lg:text-7xl xl:text-8xl font-bold tracking-tight mb-5 lg:mb-7"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          <span className="text-white">Every feature</span>
          <br />
          <span className="bg-gradient-to-r from-teal via-teal-light to-teal bg-clip-text text-transparent">you need.</span>
        </motion.h1>

        <motion.p
          className="text-base sm:text-lg lg:text-xl text-white/50 max-w-2xl mx-auto mb-10 lg:mb-14 px-4 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Purpose-built music school management software. From scheduling your first lesson
          to managing a multi-location academy — everything in one platform.
        </motion.p>

        {/* Category navigator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="mb-14 lg:mb-20"
        >
          <div className="relative">
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[hsl(var(--ink))] to-transparent z-10 pointer-events-none lg:hidden" />
            
            <div 
              ref={scrollRef}
              className="flex gap-2 justify-start lg:justify-center overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((category, index) => (
                <motion.button
                  key={category.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  onClick={() => scrollToSection(category.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 lg:px-5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                    "border",
                    activeCategory === category.id
                      ? "bg-teal text-white border-teal shadow-lg shadow-teal/20"
                      : "bg-white/[0.05] text-white/60 border-white/[0.1] hover:text-white hover:border-white/20 hover:bg-white/[0.08]"
                  )}
                >
                  <category.icon className="w-4 h-4" />
                  {category.label}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="flex flex-wrap justify-center gap-8 sm:gap-12 lg:gap-20 mb-12 lg:mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          {[
            { value: "50+", label: "Features" },
            { value: "All Plans", label: "Unlimited students" },
            { value: "UK-Built", label: "GBP & VAT ready" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">{stat.value}</p>
              <p className="text-xs sm:text-sm text-white/40 mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="flex flex-col items-center gap-2"
        >
          <p className="text-xs sm:text-sm text-white/30">Scroll to explore</p>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-5 h-5 text-white/30" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
