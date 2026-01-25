import { motion } from "framer-motion";
import { Sparkles, Star, Users } from "lucide-react";
import { BillingToggle } from "./BillingToggle";
import { TRIAL_DAYS } from "@/lib/pricing-config";

interface PricingHeroProps {
  isAnnual: boolean;
  onToggle: (annual: boolean) => void;
}

export function PricingHero({ isAnnual, onToggle }: PricingHeroProps) {
  return (
    <section className="pt-32 pb-8 lg:pt-40 lg:pb-12 relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 gradient-hero-light" />
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-teal/20 via-teal/5 to-transparent blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-coral/15 via-coral/5 to-transparent blur-3xl" />
      
      {/* Floating decorative elements */}
      <motion.div
        className="absolute top-1/4 left-[15%] w-16 h-16 rounded-2xl bg-gradient-to-br from-teal/20 to-teal/5 backdrop-blur-sm border border-teal/20 hidden lg:flex items-center justify-center"
        animate={{ 
          y: [0, -15, 0],
          rotate: [0, 5, 0]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-2xl">🎵</span>
      </motion.div>
      
      <motion.div
        className="absolute top-1/3 right-[12%] w-14 h-14 rounded-xl bg-gradient-to-br from-coral/20 to-coral/5 backdrop-blur-sm border border-coral/20 hidden lg:flex items-center justify-center"
        animate={{ 
          y: [0, 20, 0],
          rotate: [0, -5, 0]
        }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <span className="text-xl">📅</span>
      </motion.div>
      
      <motion.div
        className="absolute bottom-1/4 right-[20%] w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-sm border border-primary/20 hidden lg:flex items-center justify-center"
        animate={{ 
          y: [0, 10, 0],
          rotate: [0, 3, 0]
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <span className="text-lg">💳</span>
      </motion.div>
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />
      
      <div className="container mx-auto px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          {/* Animated badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-teal/10 border border-primary/20 text-primary text-sm font-semibold mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span>Simple, Transparent Pricing</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6"
          >
            Choose the plan that
            <br />
            <span className="bg-gradient-to-r from-teal via-primary to-coral bg-clip-text text-transparent">
              grows with you
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            Start free for 30 days. No credit card required.
            Cancel anytime, no hidden fees.
          </motion.p>
          
          {/* Billing toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mb-10"
          >
            <BillingToggle isAnnual={isAnnual} onToggle={onToggle} />
          </motion.div>
          
          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-teal to-primary border-2 border-background flex items-center justify-center"
                  >
                    <Users className="w-4 h-4 text-white" />
                  </div>
                ))}
              </div>
              <span>2,000+ educators</span>
            </div>
            
            <div className="hidden sm:block w-px h-5 bg-border" />
            
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span>4.9/5 rating</span>
            </div>
            
            <div className="hidden sm:block w-px h-5 bg-border" />
            
            <div className="flex items-center gap-1.5">
              <span className="text-success font-medium">✓</span>
              <span>{TRIAL_DAYS}-day free trial</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
