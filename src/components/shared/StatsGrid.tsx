import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsGridProps {
  children: ReactNode;
  className?: string;
}

export function StatsGrid({ children, className }: StatsGridProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4', className)}>
      {children}
    </div>
  );
}
