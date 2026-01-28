import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHint } from '@/hooks/useContextualHints';
import { cn } from '@/lib/utils';

interface ContextualHintProps {
  id: string;
  message: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  targetSelector?: string;
  autoDismissMs?: number;
  className?: string;
}

export function ContextualHint({
  id,
  message,
  position = 'bottom',
  targetSelector,
  autoDismissMs = 5000,
  className,
}: ContextualHintProps) {
  const { isVisible, dismiss } = useHint(id, autoDismissMs);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || !targetSelector) return;

    const updatePosition = () => {
      const target = document.querySelector(targetSelector);
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const hintRect = hintRef.current?.getBoundingClientRect();
      const hintWidth = hintRect?.width || 200;
      const hintHeight = hintRect?.height || 60;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - hintHeight - 8;
          left = rect.left + rect.width / 2 - hintWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + 8;
          left = rect.left + rect.width / 2 - hintWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - hintHeight / 2;
          left = rect.left - hintWidth - 8;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - hintHeight / 2;
          left = rect.right + 8;
          break;
      }

      // Keep within viewport
      left = Math.max(8, Math.min(left, window.innerWidth - hintWidth - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - hintHeight - 8));

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isVisible, targetSelector, position]);

  // If no target selector, render inline
  if (!targetSelector) {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3',
              className
            )}
          >
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="flex-1 text-sm text-foreground">{message}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={dismiss}
            >
              <X className="h-3 w-3" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Fixed position hint attached to target
  return (
    <AnimatePresence>
      {isVisible && coords && (
        <motion.div
          ref={hintRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={cn(
            'fixed z-50 flex max-w-xs items-start gap-2 rounded-lg border bg-popover p-3 shadow-lg',
            className
          )}
          style={{ top: coords.top, left: coords.left }}
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="flex-1 text-sm">{message}</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={dismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Progress indicator for hints (e.g., "1 of 3")
interface HintProgressProps {
  current: number;
  total: number;
}

export function HintProgress({ current, total }: HintProgressProps) {
  return (
    <div className="mt-2 flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            i < current ? 'bg-primary' : 'bg-muted'
          )}
        />
      ))}
    </div>
  );
}
