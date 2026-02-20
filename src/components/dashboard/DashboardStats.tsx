import { Link } from 'react-router-dom';
import { Calendar, Users, Receipt, Clock, TrendingUp, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DashboardStatsData {
  todayLessons: number;
  lessonsThisWeek: number;
  activeStudents: number;
  revenueMTD: number;
  outstandingAmount: number;
  hoursThisWeek: number;
  totalLessons: number;
}

interface DashboardStatsProps {
  stats?: DashboardStatsData | null;
  isLoading: boolean;
  currencyCode: string;
}

function StatTile({
  icon: Icon,
  label,
  value,
  href,
  color = 'text-foreground',
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  href: string;
  color?: string;
  trend?: string;
}) {
  return (
    <Link to={href}>
      <Card data-interactive className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <p className={cn('text-2xl font-bold tracking-tight', color)}>{value}</p>
            {trend && (
              <p className="text-xs text-muted-foreground">{trend}</p>
            )}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
            <Icon className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function DashboardStats({ stats, isLoading, currencyCode }: DashboardStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      icon: Calendar,
      label: 'Today',
      value: stats.todayLessons,
      href: '/calendar',
      trend: 'lessons scheduled',
    },
    {
      icon: BookOpen,
      label: 'This Week',
      value: stats.lessonsThisWeek,
      href: '/calendar',
      trend: `${stats.hoursThisWeek.toFixed(1)}h teaching`,
    },
    {
      icon: Users,
      label: 'Students',
      value: stats.activeStudents,
      href: '/students',
      trend: 'active',
    },
    {
      icon: TrendingUp,
      label: 'Revenue MTD',
      value: formatCurrency(stats.revenueMTD),
      href: '/reports/revenue',
      color: 'text-success',
    },
    {
      icon: Receipt,
      label: 'Outstanding',
      value: formatCurrency(stats.outstandingAmount),
      href: '/reports/outstanding',
      color: stats.outstandingAmount > 0 ? 'text-destructive' : 'text-foreground',
    },
    {
      icon: Clock,
      label: 'Hours',
      value: stats.hoursThisWeek.toFixed(1),
      href: '/reports/lessons-delivered',
      trend: 'this week',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <StatTile key={card.label} {...card} />
      ))}
    </div>
  );
}
