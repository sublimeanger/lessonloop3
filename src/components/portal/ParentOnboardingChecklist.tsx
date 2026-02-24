import { useState, useMemo, useEffect, useCallback } from 'react';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Calendar, Receipt, MessageSquare,
  ChevronRight, X, Sparkles, PartyPopper, User, Timer,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useParentOnboardingProgress, type ParentOnboardingStatus } from '@/hooks/useParentOnboardingProgress';
import { cn } from '@/lib/utils';

type ChecklistConfigItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  checkKey: keyof ParentOnboardingStatus;
};

const CHECKLIST_CONFIG: ChecklistConfigItem[] = [
  { id: 'profile', title: 'Complete your profile', description: 'Add your phone number for notifications', href: '/portal/profile', icon: User, checkKey: 'hasProfile' },
  { id: 'schedule', title: 'Review upcoming schedule', description: "See your children's upcoming lessons", href: '/portal/schedule', icon: Calendar, checkKey: 'hasVisitedSchedule' },
  { id: 'practice', title: 'Try the practice timer', description: 'Track practice sessions at home', href: '/portal/practice', icon: Timer, checkKey: 'hasPracticed' },
  { id: 'message', title: 'Send a message', description: "Get in touch with your child's teacher", href: '/portal/messages', icon: MessageSquare, checkKey: 'hasSentMessage' },
  { id: 'invoices', title: 'View invoices', description: 'Check your billing and payment history', href: '/portal/invoices', icon: Receipt, checkKey: 'hasViewedInvoices' },
];

function ProgressRing({ progress, size = 48 }: { progress: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-primary"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
    </div>
  );
}

export function ParentOnboardingChecklist({ className }: { className?: string }) {
  const { user } = useAuth();
  const userId = user?.id;
  const storageKey = `ll-parent-checklist-dismissed-${userId}`;
  const { data: status, isLoading } = useParentOnboardingProgress();
  const [isDismissed, setIsDismissed] = useState(() => safeGetItem(storageKey) === 'true');
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (safeGetItem(storageKey) === 'true') {
      setIsDismissed(true);
    }
  }, [storageKey]);

  const items = useMemo(() => {
    if (!status) return [];
    return CHECKLIST_CONFIG.map(item => ({
      ...item,
      completed: status[item.checkKey] || false,
    }));
  }, [status]);

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = completedCount === totalCount && totalCount > 0;

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    safeSetItem(storageKey, 'true');
  }, [storageKey]);

  useEffect(() => {
    if (allCompleted) {
      setShowCelebration(true);
      const timer = setTimeout(() => dismiss(), 5000);
      return () => clearTimeout(timer);
    }
  }, [allCompleted, dismiss]);

  if (isDismissed || isLoading || items.length === 0) return null;

  if (showCelebration) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-5 text-primary-foreground sm:p-6', className)}
      >
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
            transition={{ duration: 0.5, repeat: 2 }}
          >
            <PartyPopper className="h-12 w-12" />
          </motion.div>
          <div>
            <h3 className="text-section-title tracking-tight">You're all set!</h3>
            <p className="text-caption text-primary-foreground/85">You've explored all the parent portal features. Enjoy!</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <Card className={cn('relative overflow-hidden border-primary/20', className)}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-10 h-11 w-11 text-muted-foreground hover:text-foreground"
        onClick={dismiss}
        aria-label="Dismiss checklist"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />

      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <ProgressRing progress={progressPercent} />
          <div className="flex-1">
            <CardTitle className="text-section-title tracking-tight">Welcome!</CardTitle>
            <CardDescription>
              {completedCount} of {totalCount} steps complete
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-body">
            {Math.round(progressPercent)}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ul className="space-y-2" role="list">
          <AnimatePresence>
            {items.map((item, index) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={item.completed ? '#' : item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl p-3 transition-all',
                    item.completed
                      ? 'cursor-default opacity-60'
                      : 'hover:bg-accent hover:shadow-sm',
                  )}
                  tabIndex={item.completed ? -1 : 0}
                >
                  <motion.div
                    initial={false}
                    animate={item.completed ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {item.completed ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-body-strong',
                      item.completed && 'line-through text-muted-foreground',
                    )}>
                      {item.title}
                    </p>
                    <p className="text-caption text-muted-foreground truncate">
                      {item.description}
                    </p>
                  </div>

                  {!item.completed && (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  )}
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </CardContent>
    </Card>
  );
}
