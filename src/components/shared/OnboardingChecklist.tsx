import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, Circle, Users, Calendar, Receipt, 
  Building, ChevronRight, X, Sparkles, PartyPopper
} from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

// Animated progress ring
function ProgressRing({ progress, size = 48 }: { progress: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
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
          style={{
            strokeDasharray: circumference,
          }}
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
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (!currentOrg) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      try {
        // Add timeout to prevent indefinite hangs
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        
        // Check completion status in parallel with timeout
        const [studentsResult, lessonsResult, invoicesResult, locationsResult] = await Promise.race([
          Promise.all([
            supabase
              .from('students')
              .select('id', { count: 'exact', head: true })
              .eq('org_id', currentOrg.id)
              .eq('status', 'active'),
            supabase
              .from('lessons')
              .select('id', { count: 'exact', head: true })
              .eq('org_id', currentOrg.id),
            supabase
              .from('invoices')
              .select('id', { count: 'exact', head: true })
              .eq('org_id', currentOrg.id),
            supabase
              .from('locations')
              .select('id', { count: 'exact', head: true })
              .eq('org_id', currentOrg.id),
          ]),
          timeoutPromise
        ]);

        const hasStudents = (studentsResult.count || 0) > 0;
        const hasLessons = (lessonsResult.count || 0) > 0;
        const hasInvoices = (invoicesResult.count || 0) > 0;
        const hasLocations = (locationsResult.count || 0) > 0;

      const checklistItems: ChecklistItem[] = [
        {
          id: 'add-student',
          title: 'Add your first student',
          description: 'Start managing your student roster',
          href: '/students',
          icon: Users,
          completed: hasStudents,
        },
        {
          id: 'schedule-lesson',
          title: 'Schedule a lesson',
          description: 'Create your first lesson in the calendar',
          href: '/calendar',
          icon: Calendar,
          completed: hasLessons,
        },
        {
          id: 'add-location',
          title: 'Add a teaching location',
          description: 'Set up your teaching venues',
          href: '/locations',
          icon: Building,
          completed: hasLocations,
        },
        {
          id: 'create-invoice',
          title: 'Create your first invoice',
          description: 'Bill your students for lessons',
          href: '/invoices',
          icon: Receipt,
          completed: hasInvoices,
        },
      ];

      setItems(checklistItems);
      setIsLoading(false);
      
        // Show celebration when all complete
        const allComplete = checklistItems.every(item => item.completed);
        if (allComplete && checklistItems.length > 0) {
          setShowCelebration(true);
          setTimeout(() => setIsDismissed(true), 3000);
        }
      } catch (error) {
        console.warn('Checklist check failed:', error);
        setItems([]); // Hide checklist if queries fail
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, [currentOrg]);

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = completedCount === totalCount && totalCount > 0;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed || isLoading || items.length === 0) {
    return null;
  }

  // Celebration state
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
      {/* Dismiss button */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground z-10"
        onClick={handleDismiss}
        aria-label="Dismiss checklist"
      >
        <X className="h-4 w-4" />
      </Button>
      
      {/* Decorative gradient */}
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
