import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BillingToggleProps {
  isAnnual: boolean;
  onToggle: (annual: boolean) => void;
}

export function BillingToggle({ isAnnual, onToggle }: BillingToggleProps) {
  return (
    <div className="inline-flex items-center gap-3 p-1.5 rounded-full bg-muted/50 border border-border backdrop-blur-sm">
      <button
        onClick={() => onToggle(false)}
        className={cn(
          "relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
          !isAnnual 
            ? "text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {!isAnnual && (
          <motion.div
            layoutId="billing-bg"
            className="absolute inset-0 bg-primary rounded-full shadow-lg"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <span className="relative z-10">Monthly</span>
      </button>
      
      <button
        onClick={() => onToggle(true)}
        className={cn(
          "relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2",
          isAnnual 
            ? "text-primary-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {isAnnual && (
          <motion.div
            layoutId="billing-bg"
            className="absolute inset-0 bg-primary rounded-full shadow-lg"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <span className="relative z-10">Annual</span>
        <motion.span 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "relative z-10 px-2 py-0.5 rounded-full text-xs font-bold",
            isAnnual 
              ? "bg-success/20 text-success" 
              : "bg-success/10 text-success"
          )}
        >
          Save 16%
        </motion.span>
      </button>
    </div>
  );
}
