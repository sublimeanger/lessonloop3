import { useState, useMemo, useEffect, useCallback } from 'react';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, Circle, Users, Calendar, Receipt, 
  Building, ChevronRight, X, Sparkles, PartyPopper, 
  UserPlus, Settings, FileText
} from 'lucide-react';
import { useOrg, OrgType } from '@/contexts/OrgContext';
import { useOnboardingProgress, OnboardingStatus } from '@/hooks/useOnboardingProgress';
import { cn } from '@/lib/utils';

type ChecklistConfigItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  checkKey: keyof OnboardingStatus;
};

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  completed: boolean;
}

interface OnboardingChecklistProps {
  onDismiss?: () => void;
  className?: string;
}

const CHECKLIST_CONFIG: Record<OrgType, ChecklistConfigItem[]> = {
  solo_teacher: [
    { id: 'add-student', title: 'Add your first student', description: 'Start managing your student roster', href: '/students', icon: Users, checkKey: 'hasStudents' },
    { id: 'schedule-lesson', title: 'Schedule a lesson', description: 'Create your first lesson in the calendar', href: '/calendar', icon: Calendar, checkKey: 'hasLessons' },
    { id: 'add-location', title: 'Add a teaching location', description: 'Set up your teaching venues', href: '/locations', icon: Building, checkKey: 'hasLocations' },
    { id: 'create-invoice', title: 'Create your first invoice', description: 'Bill your students for lessons', href: '/invoices', icon: Receipt, checkKey: 'hasInvoices' },
  ],
  studio: [
    { id: 'add-location', title: 'Set up your studio', description: 'Add your teaching location with rooms', href: '/locations', icon: Building, checkKey: 'hasLocations' },
    { id: 'invite-teacher', title: 'Invite a teacher', description: 'Build your team', href: '/teachers', icon: UserPlus, checkKey: 'hasTeachers' },
    { id: 'add-student', title: 'Add students', description: 'Start enrolling students', href: '/students', icon: Users, checkKey: 'hasStudents' },
    { id: 'run-billing', title: 'Run your first billing', description: 'Generate invoices for lessons', href: '/invoices', icon: Receipt, checkKey: 'hasInvoices' },
  ],
  academy: [
    { id: 'add-locations', title: 'Set up locations', description: 'Add your teaching venues and rooms', href: '/locations', icon: Building, checkKey: 'hasLocations' },
    { id: 'invite-team', title: 'Invite your team', description: 'Add teachers and admin staff', href: '/teachers', icon: UserPlus, checkKey: 'hasTeachers' },
    { id: 'add-students', title: 'Enrol students', description: 'Add students individually or import', href: '/students', icon: Users, checkKey: 'hasStudents' },
    { id: 'schedule-lessons', title: 'Schedule lessons', description: 'Create your timetable', href: '/calendar', icon: Calendar, checkKey: 'hasLessons' },
  ],
  agency: [
    { id: 'add-client-sites', title: 'Add client schools', description: 'Set up schools where teachers work', href: '/locations', icon: Building, checkKey: 'hasLocations' },
    { id: 'invite-teachers', title: 'Invite teachers', description: 'Build your team of peripatetic teachers', href: '/teachers', icon: UserPlus, checkKey: 'hasTeachers' },
    { id: 'configure-policy', title: 'Set scheduling policy', description: 'Control how parents request changes', href: '/settings', icon: Settings, checkKey: 'hasPolicyConfigured' },
    { id: 'add-students', title: 'Add students', description: 'Enrol students at client sites', href: '/students', icon: Users, checkKey: 'hasStudents' },
  ],
};

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

export function OnboardingChecklist({ onDismiss, className }: OnboardingChecklistProps) {
  const { currentOrg } = useOrg();
  const { data: status, isLoading } = useOnboardingProgress();
  const storageKey = `ll-checklist-dismissed-${currentOrg?.id}`;
  const [isDismissed, setIsDismissed] = useState(() => safeGetItem(storageKey) === 'true');
  const [showCelebration, setShowCelebration] = useState(false);

  // Re-check storage when org changes
  useEffect(() => {
    setIsDismissed(safeGetItem(storageKey) === 'true');
  }, [storageKey]);

  const items = useMemo<ChecklistItem[]>(() => {
    if (!currentOrg || !status) return [];
    const orgType = currentOrg.org_type;
    const config = CHECKLIST_CONFIG[orgType] || CHECKLIST_CONFIG.solo_teacher;
    return config.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      href: item.href,
      icon: item.icon,
      completed: status[item.checkKey] || false,
    }));
  }, [currentOrg, status]);

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

  const handleDismiss = () => {
    dismiss();
    onDismiss?.();
  };

  if (isDismissed || isLoading || items.length === 0) {
    return null;
  }

  if (showCelebration) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal to-teal-dark p-6 text-white', className)}
      >
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
            transition={{ duration: 0.5, repeat: 2 }}
          >
            <PartyPopper className="h-12 w-12" />
          </motion.div>
          <div>
            <h3 className="text-xl font-bold">You're all set! 🎉</h3>
            <p className="text-white/80">You've completed all the setup steps. Happy teaching!</p>
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
        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground z-10"
        onClick={handleDismiss}
        aria-label="Dismiss checklist"
      >
        <X className="h-4 w-4" />
      </Button>
      
      <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
      
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <ProgressRing progress={progressPercent} />
          <div className="flex-1">
            <CardTitle className="text-lg">Get Started</CardTitle>
            <CardDescription>
              {completedCount} of {totalCount} steps complete
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm">
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
                    'group flex items-center gap-3 rounded-lg p-3 transition-all',
                    item.completed 
                      ? 'cursor-default opacity-60' 
                      : 'hover:bg-accent hover:shadow-sm'
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
                      'text-sm font-medium',
                      item.completed && 'line-through text-muted-foreground'
                    )}>
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
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
