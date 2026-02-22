import { motion } from "framer-motion";
import { 
  Calendar, 
  Receipt, 
  Users, 
  Sparkles, 
  BarChart3, 
  RefreshCw,
  ChevronDown
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
    <section className="relative min-h-[70vh] lg:min-h-[85vh] flex flex-col items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <motion.div
          className="absolute top-1/4 -left-32 w-[400px] lg:w-[600px] h-[400px] lg:h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)",
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-32 w-[300px] lg:w-[500px] h-[300px] lg:h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(var(--coral) / 0.12) 0%, transparent 70%)",
          }}
          animate={{
            x: [0, -40, 0],
            y: [0, 40, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                              linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
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
          className="bg-card border border-border rounded-xl p-3 shadow-lg"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-teal" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lesson scheduled</p>
              <p className="text-sm font-medium">Today, 3:00 PM</p>
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
          className="bg-card border border-border rounded-xl p-3 shadow-lg"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/20 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment received</p>
              <p className="text-sm font-medium text-success">£45.00</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute bottom-[25%] left-[10%] hidden xl:block"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <motion.div
          className="bg-card border border-border rounded-xl p-3 shadow-lg"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-coral/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-coral" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">LoopAssist</p>
              <p className="text-sm font-medium">3 invoices ready</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Category navigator - horizontal scroll on mobile */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 lg:mb-12"
        >
          <div className="relative">
            {/* Right edge fade on mobile */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none lg:hidden" />
            
            <div 
              ref={scrollRef}
              className="flex gap-2 justify-start lg:justify-center overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {categories.map((category, index) => (
                <motion.button
                  key={category.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => scrollToSection(category.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 lg:px-4 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                    "border hover:border-primary/50",
                    activeCategory === category.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card/80 text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  <category.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{category.label}</span>
                  <span className="sm:hidden">{category.label.split(' ')[0]}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-4 lg:mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <span className="text-foreground">Every feature you need.</span>
          <br />
          <span className="text-muted-foreground">Zero you don't.</span>
        </motion.h1>

        <motion.p
          className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 lg:mb-8 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          Purpose-built for music educators. From scheduling your first lesson
          to managing a multi-location academy, we've got you covered.
        </motion.p>

        {/* Stats */}
        <motion.div
          className="flex flex-wrap justify-center gap-6 sm:gap-10 lg:gap-16 mb-10 lg:mb-16"
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
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
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
          <p className="text-xs sm:text-sm text-muted-foreground">Scroll to explore</p>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
