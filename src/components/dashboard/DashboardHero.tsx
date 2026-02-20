import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardHeroProps {
  firstName: string;
  todayLessons?: number;
  needsAttendance?: number;
  outstandingAmount?: number;
  unreadMessages?: number;
  currencyCode?: string;
  hasStudents?: boolean;
  hasLessons?: boolean;
  className?: string;
}

export function DashboardHero({
  firstName,
  todayLessons = 0,
  needsAttendance = 0,
  outstandingAmount = 0,
  unreadMessages = 0,
  currencyCode = 'GBP',
  hasStudents = false,
  hasLessons = false,
  className,
}: DashboardHeroProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // New user states
  if (!hasStudents) {
    return (
      <div className={cn('space-y-1', className)} data-tour="dashboard-hero">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          Welcome, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Let's add your first student to get started.
        </p>
      </div>
    );
  }

  const stats = [
    {
      value: todayLessons,
      label: todayLessons === 1 ? 'lesson today' : 'lessons today',
      href: '/calendar',
      color: '',
    },
    needsAttendance > 0
      ? {
          value: needsAttendance,
          label: 'need attendance',
          href: '/register',
          color: 'text-warning',
        }
      : null,
    outstandingAmount > 0
      ? {
          value: formatCurrency(outstandingAmount),
          label: 'outstanding',
          href: '/reports/outstanding',
          color: 'text-destructive',
        }
      : null,
    unreadMessages > 0
      ? {
          value: unreadMessages,
          label: unreadMessages === 1 ? 'message' : 'messages',
          href: '/messages',
          color: '',
        }
      : null,
  ].filter(Boolean) as Array<{ value: number | string; label: string; href: string; color: string }>;

  return (
    <div className={cn('space-y-1', className)} data-tour="dashboard-hero">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          {getGreeting()}, {firstName}
        </h1>
        <span className="text-sm text-muted-foreground shrink-0 hidden sm:inline">
          {format(new Date(), 'EEEE, d MMMM')}
        </span>
      </div>

      {stats.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
          {stats.map((stat, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && <span className="mx-1.5">·</span>}
              <Link
                to={stat.href}
                className={cn(
                  'inline-flex items-center gap-1 hover:underline underline-offset-2 transition-colors hover:text-foreground',
                  stat.color,
                )}
              >
                <span className="font-mono font-semibold text-foreground">
                  {stat.value}
                </span>
                <span>{stat.label}</span>
              </Link>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
