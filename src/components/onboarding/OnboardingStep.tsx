import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';
import { AlertCircle, Info } from 'lucide-react';

interface OnboardingStepProps {
  children: ReactNode;
  stepKey: string | number;
  title: string;
  subtitle?: string;
  hint?: string;
  error?: string | null;
}

export function OnboardingStep({ 
  children, 
  stepKey, 
  title, 
  subtitle, 
  hint,
  error 
}: OnboardingStepProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-1">
          <motion.h2 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-foreground"
          >
            {title}
          </motion.h2>
          {subtitle && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground"
            >
              {subtitle}
            </motion.p>
          )}
        </div>

        {/* Contextual hint */}
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground"
          >
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{hint}</span>
          </motion.div>
        )}

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-sm text-destructive border border-destructive/20"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
