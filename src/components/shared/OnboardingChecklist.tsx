import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, Circle, Users, Calendar, Receipt, 
  Building, ChevronRight, X, Sparkles 
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

export function OnboardingChecklist({ onDismiss, className }: OnboardingChecklistProps) {
  const { currentOrg } = useOrg();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (!currentOrg) return;
      
      setIsLoading(true);
      
      // Check completion status in parallel
      const [studentsResult, lessonsResult, invoicesResult, locationsResult] = await Promise.all([
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

  if (isDismissed || allCompleted || isLoading || items.length === 0) {
    return null;
  }

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div className="absolute right-2 top-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleDismiss}
          aria-label="Dismiss checklist"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-lg">Get Started</CardTitle>
          <Badge variant="secondary" className="ml-auto mr-8">
            {completedCount}/{totalCount}
          </Badge>
        </div>
        <CardDescription>Complete these steps to set up your teaching business</CardDescription>
        <Progress value={progressPercent} className="mt-3 h-2" aria-label={`${completedCount} of ${totalCount} steps completed`} />
      </CardHeader>
      
      <CardContent className="pt-0">
        <ul className="space-y-1" role="list">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.completed ? '#' : item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg p-3 transition-colors',
                  item.completed 
                    ? 'cursor-default opacity-60' 
                    : 'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
                aria-label={`${item.title}${item.completed ? ' - completed' : ''}`}
                tabIndex={item.completed ? -1 : 0}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    item.completed && 'line-through'
                  )}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                {!item.completed && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
