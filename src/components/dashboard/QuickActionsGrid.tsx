import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, Calendar, Receipt, TrendingUp, 
  Plus, FileText, Settings, BookOpen, 
  Zap, LucideIcon 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  variant: 'teal' | 'coral' | 'violet' | 'emerald';
}

interface QuickActionsGridProps {
  variant?: 'solo' | 'academy' | 'teacher';
  className?: string;
}

const soloActions: QuickAction[] = [
  {
    id: 'add-student',
    label: 'Add Student',
    description: 'Enroll a new student',
    href: '/students',
    icon: Users,
    variant: 'teal',
  },
  {
    id: 'schedule-lesson',
    label: 'Schedule Lesson',
    description: 'Create a new lesson',
    href: '/calendar',
    icon: Calendar,
    variant: 'coral',
  },
  {
    id: 'create-invoice',
    label: 'Create Invoice',
    description: 'Bill your students',
    href: '/invoices',
    icon: Receipt,
    variant: 'violet',
  },
  {
    id: 'view-reports',
    label: 'View Reports',
    description: 'Track your progress',
    href: '/reports/revenue',
    icon: TrendingUp,
    variant: 'emerald',
  },
];

const academyActions: QuickAction[] = [
  {
    id: 'add-student',
    label: 'Add Student',
    description: 'Enroll a new student',
    href: '/students',
    icon: Users,
    variant: 'teal',
  },
  {
    id: 'invite-teacher',
    label: 'Invite Teacher',
    description: 'Grow your team',
    href: '/teachers',
    icon: Plus,
    variant: 'coral',
  },
  {
    id: 'run-billing',
    label: 'Run Billing',
    description: 'Generate invoices',
    href: '/invoices',
    icon: Receipt,
    variant: 'violet',
  },
  {
    id: 'payroll',
    label: 'Payroll Report',
    description: 'Teacher payments',
    href: '/reports/payroll',
    icon: TrendingUp,
    variant: 'emerald',
  },
];

const teacherActions: QuickAction[] = [
  {
    id: 'view-calendar',
    label: 'My Calendar',
    description: 'View your schedule',
    href: '/calendar',
    icon: Calendar,
    variant: 'teal',
  },
  {
    id: 'daily-register',
    label: 'Daily Register',
    description: 'Mark attendance',
    href: '/register',
    icon: BookOpen,
    variant: 'coral',
  },
  {
    id: 'my-students',
    label: 'My Students',
    description: 'View assigned students',
    href: '/students',
    icon: Users,
    variant: 'violet',
  },
  {
    id: 'resources',
    label: 'Resources',
    description: 'Teaching materials',
    href: '/resources',
    icon: FileText,
    variant: 'emerald',
  },
];

const variantStyles = {
  teal: {
    bg: 'bg-teal/10',
    text: 'text-teal',
    hoverBg: 'group-hover:bg-teal/20',
    borderHover: 'hover:border-teal/30',
  },
  coral: {
    bg: 'bg-coral/10',
    text: 'text-coral',
    hoverBg: 'group-hover:bg-coral/20',
    borderHover: 'hover:border-coral/30',
  },
  violet: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-500',
    hoverBg: 'group-hover:bg-violet-500/20',
    borderHover: 'hover:border-violet-500/30',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    hoverBg: 'group-hover:bg-emerald-500/20',
    borderHover: 'hover:border-emerald-500/30',
  },
};

function ActionCard({ action, index }: { action: QuickAction; index: number }) {
  const styles = variantStyles[action.variant];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link to={action.href}>
        <div
          className={cn(
            'group flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center transition-all duration-200',
            'hover:shadow-md hover:-translate-y-0.5',
            styles.borderHover
          )}
        >
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-xl transition-colors',
              styles.bg,
              styles.hoverBg
            )}
          >
            <action.icon className={cn('h-7 w-7', styles.text)} />
          </div>
          <h3 className="mt-4 font-semibold">{action.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
        </div>
      </Link>
    </motion.div>
  );
}

export function QuickActionsGrid({ variant = 'solo', className }: QuickActionsGridProps) {
  const actions = variant === 'academy' 
    ? academyActions 
    : variant === 'teacher' 
    ? teacherActions 
    : soloActions;
  
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center gap-3 border-b pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-coral/10">
          <Zap className="h-5 w-5 text-coral" />
        </div>
        <div>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <p className="text-sm text-muted-foreground">Common tasks at your fingertips</p>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {actions.map((action, index) => (
            <ActionCard key={action.id} action={action} index={index} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
