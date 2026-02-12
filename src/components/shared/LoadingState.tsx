import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading...', className }: LoadingStateProps) {
  return (
    <div 
      className={cn('flex min-h-[400px] flex-col items-center justify-center', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      <span className="sr-only">{message}</span>
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <Loader2 
      className={cn('h-4 w-4 animate-spin', className)} 
      aria-hidden="true"
    />
  );
}

// Card skeleton for lists
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-3 w-[200px]" />
        </div>
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// Stats card skeleton
export function StatsCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

// Grid skeleton for cards
export function GridSkeleton({ 
  count = 4, 
  columns = 4,
  className 
}: { 
  count?: number; 
  columns?: number;
  className?: string;
}) {
  const gridCols = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[columns] || 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={cn('grid gap-4', gridCols, className)} role="status" aria-label="Loading content">
      {Array.from({ length: count }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// List skeleton
export function ListSkeleton({ 
  count = 5,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Loading list">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Calendar day skeleton
export function CalendarDaySkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

// App shell skeleton - mimics AppLayout during auth loading
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <div className="hidden md:flex w-60 flex-col border-r bg-sidebar p-4 gap-6">
        <div className="flex items-center gap-2 px-2">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4" style={{ width: `${60 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-3 border-t pt-4">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-md md:hidden" />
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-5 w-24 hidden sm:block" />
            <Skeleton className="h-4 w-px mx-1" />
            <Skeleton className="h-5 w-28 hidden sm:block" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <StatsCardSkeleton key={i} />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Form skeleton
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-4">
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
      <span className="sr-only">Loading form...</span>
    </div>
  );
}
