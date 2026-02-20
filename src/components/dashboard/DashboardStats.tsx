import { Users, Calendar, Receipt, TrendingUp } from 'lucide-react';
import { StatCard } from './StatCard';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStatsProps {
  stats?: {
    activeStudents?: number;
    todayLessons?: number;
    outstandingAmount?: number;
    revenueMTD?: number;
  } | null;
  isLoading: boolean;
  currencyCode: string;
}

function formatCurrency(amount: number, code: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardStats({ stats, isLoading, currencyCode }: DashboardStatsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Active Students"
        value={stats?.activeStudents ?? 0}
        icon={Users}
        href="/students"
        variant="teal"
      />
      <StatCard
        title="Today's Lessons"
        value={stats?.todayLessons ?? 0}
        icon={Calendar}
        href="/calendar"
        variant="violet"
      />
      <StatCard
        title="Outstanding"
        value={formatCurrency(stats?.outstandingAmount ?? 0, currencyCode)}
        icon={Receipt}
        href="/reports/outstanding"
        variant="coral"
      />
      <StatCard
        title="Revenue MTD"
        value={formatCurrency(stats?.revenueMTD ?? 0, currencyCode)}
        icon={TrendingUp}
        href="/reports/revenue"
        variant="emerald"
      />
    </div>
  );
}
