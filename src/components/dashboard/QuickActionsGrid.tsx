import { Link } from 'react-router-dom';
import {
  Calendar, ClipboardList, Receipt, MessageSquare,
  Users, Plus, BookOpen, FileText,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
}

interface QuickActionsGridProps {
  variant?: 'solo' | 'academy' | 'teacher';
  className?: string;
}

const soloActions: QuickAction[] = [
  { id: 'new-lesson', label: 'New Lesson', href: '/calendar', icon: Calendar, primary: true },
  { id: 'attendance', label: 'Record Attendance', href: '/register', icon: ClipboardList },
  { id: 'invoice', label: 'Create Invoice', href: '/invoices', icon: Receipt },
  { id: 'message', label: 'Send Message', href: '/messages', icon: MessageSquare },
];

const academyActions: QuickAction[] = [
  { id: 'new-lesson', label: 'New Lesson', href: '/calendar', icon: Calendar, primary: true },
  { id: 'attendance', label: 'Record Attendance', href: '/register', icon: ClipboardList },
  { id: 'billing', label: 'Run Billing', href: '/invoices', icon: Receipt },
  { id: 'message', label: 'Send Message', href: '/messages', icon: MessageSquare },
];

const teacherActions: QuickAction[] = [
  { id: 'calendar', label: 'My Calendar', href: '/calendar', icon: Calendar, primary: true },
  { id: 'register', label: 'Daily Register', href: '/register', icon: BookOpen },
  { id: 'students', label: 'My Students', href: '/students', icon: Users },
  { id: 'message', label: 'Send Message', href: '/messages', icon: MessageSquare },
];

export function QuickActionsGrid({ variant = 'solo', className }: QuickActionsGridProps) {
  const actions = variant === 'academy'
    ? academyActions
    : variant === 'teacher'
    ? teacherActions
    : soloActions;

  return (
    <Card className={cn('', className)} data-tour="quick-actions">
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-body-strong">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map((action) => (
            <Link
              key={action.id}
              to={action.href}
              className={cn(
                'flex min-h-11 items-center gap-2 sm:gap-3 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 transition-all',
                'hover:shadow-sm active:scale-[0.98]',
                action.primary
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted/50 text-foreground hover:bg-muted',
              )}
            >
              <action.icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" strokeWidth={1.5} />
              <span className="text-body font-medium truncate">{action.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
