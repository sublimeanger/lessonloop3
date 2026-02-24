import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Trophy, Star, Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakCelebrationProps {
  streak: number;
  onDismiss: () => void;
}

const MILESTONES: Record<number, { emoji: string; message: string; sub: string }> = {
  3: { emoji: '⚡', message: 'Momentum!', sub: '3 days in a row — keep it going!' },
  7: { emoji: '🔥', message: 'One Week!', sub: "A full week of practice — you're on fire!" },
  14: { emoji: '🔥🔥', message: 'Two Weeks!', sub: 'Incredible dedication — 14 days strong!' },
  30: { emoji: '🏆', message: 'One Month!', sub: "30 days! You're a practice legend!" },
  60: { emoji: '🌟', message: 'Two Months!', sub: '60 days of commitment — truly inspiring!' },
  100: { emoji: '💎', message: 'Centurion!', sub: '100 days! An extraordinary achievement!' },
};

function getIcon(streak: number) {
  if (streak >= 30) return Trophy;
  if (streak >= 14) return Flame;
  if (streak >= 7) return Flame;
  return streak >= 3 ? Zap : Star;
}

function getColor(streak: number) {
  if (streak >= 30) return 'text-warning';
  if (streak >= 14) return 'text-coral';
  if (streak >= 7) return 'text-destructive';
  return 'text-warning';
}

// Simple confetti particle component (no extra dependency)
function ConfettiParticle({ delay, x }: { delay: number; x: number }) {
  const colors = ['bg-warning', 'bg-coral', 'bg-destructive', 'bg-warning', 'bg-primary', 'bg-success'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 6 + Math.random() * 6;
  const rotation = Math.random() * 360;

  return (
    <motion.div
      className={cn('absolute rounded-sm', color)}
      style={{ width: size, height: size, left: `${x}%`, top: -10 }}
      initial={{ opacity: 1, y: -20, rotate: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, 300 + Math.random() * 200],
        x: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200],
        rotate: rotation + Math.random() * 720,
      }}
      transition={{
        duration: 2 + Math.random(),
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

export function StreakCelebration({ streak, onDismiss }: StreakCelebrationProps) {
  const [visible, setVisible] = useState(true);
  const milestone = MILESTONES[streak];
  const Icon = getIcon(streak);
  const color = getColor(streak);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 400);
  };

  if (!milestone) return null;

  // Generate confetti particles
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.6,
    x: Math.random() * 100,
  }));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleDismiss}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

          {/* Confetti layer */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map(p => (
              <ConfettiParticle key={p.id} delay={p.delay} x={p.x} />
            ))}
          </div>

          {/* Content */}
          <motion.div
            className="relative z-10 max-w-[calc(100vw-2rem)] space-y-4 overflow-hidden text-center p-5 sm:max-w-sm sm:p-8"
            initial={{ scale: 0.5, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground transition-colors sm:h-8 sm:w-8"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Animated icon */}
            <motion.div
              className="mx-auto"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, -10, 10, 0],
              }}
              transition={{
                duration: 0.8,
                repeat: 2,
                repeatType: 'loop',
              }}
            >
              <div className={cn(
                'inline-flex items-center justify-center w-24 h-24 rounded-full',
                'bg-card border-2 border-primary/20 shadow-lg'
              )}>
                <Icon className={cn('h-12 w-12', color)} />
              </div>
            </motion.div>

            {/* Streak count */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <p className="text-4xl mb-1">{milestone.emoji}</p>
              <h2 className={cn('text-3xl font-bold', color)}>
                {milestone.message}
              </h2>
              <p className="text-5xl font-black text-foreground mt-1">
                {streak} Days
              </p>
            </motion.div>

            {/* Sub message */}
            <motion.p
              className="text-muted-foreground text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {milestone.sub}
            </motion.p>

            {/* Tap to dismiss hint */}
            <motion.p
              className="text-xs text-muted-foreground/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Tap anywhere to dismiss
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
