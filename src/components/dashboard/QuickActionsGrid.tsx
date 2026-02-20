import { Link } from 'react-router-dom';
import {
  Calendar, ClipboardList, Receipt, MessageSquare,
  Users, Plus, BookOpen, FileText,
  type LucideIcon,
} from 'lucide-react';
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
    <div className={cn('', className)} data-tour="quick-actions">
      <h2 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <Link
            key={action.id}
            to={action.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3 transition-all',
              'hover:shadow-sm active:scale-[0.98]',
              action.primary
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted/50 text-foreground hover:bg-muted',
            )}
          >
            <action.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            <span className="text-sm font-medium">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
