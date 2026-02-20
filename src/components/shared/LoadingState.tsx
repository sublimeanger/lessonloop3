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

// ─── Shimmer block helper ────────────────────────────────────────────
function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted', className)} style={style} />;
}

// ─── Calendar Skeleton ───────────────────────────────────────────────
export function CalendarSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading calendar">
      {/* Day header row */}
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Shimmer key={i} className="h-8 flex-1" />
        ))}
      </div>
      {/* Time slots */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-2">
            <Shimmer className="h-5 w-12 rounded-lg" />
            <div className="flex-1 flex gap-2">
              <Shimmer className={cn('h-14', i % 3 === 0 ? 'w-2/5' : i % 2 === 0 ? 'w-3/5' : 'w-1/3')} />
              {i % 2 === 0 && <Shimmer className="h-14 w-1/4" />}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading calendar...</span>
    </div>
  );
}

// ─── List Skeleton (upgraded card design) ────────────────────────────
export function ListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 flex items-center gap-4">
          <Shimmer className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Shimmer className={cn('h-4', i % 2 === 0 ? 'w-2/5' : 'w-1/3')} />
            <Shimmer className={cn('h-3', i % 3 === 0 ? 'w-3/5' : 'w-1/2')} />
          </div>
          <Shimmer className="h-6 w-16 rounded-lg shrink-0" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ─── Dashboard Skeleton ──────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      {/* Hero greeting */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-4 w-64" />
      </div>
      {/* Stats bar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-4 rounded-lg" />
            </div>
            <Shimmer className="h-7 w-14" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Timeline items */}
      <div className="space-y-3">
        <Shimmer className="h-5 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <Shimmer className="h-10 w-1 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Shimmer className={cn('h-4', i % 2 === 0 ? 'w-2/5' : 'w-1/3')} />
              <Shimmer className="h-3 w-1/2" />
            </div>
            <Shimmer className="h-6 w-12 rounded-lg" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading dashboard...</span>
    </div>
  );
}

// ─── Detail Page Skeleton (side panel style) ─────────────────────────
export function DetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading details">
      {/* Header area */}
      <div className="flex items-center gap-4">
        <Shimmer className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-6 w-40" />
          <Shimmer className="h-4 w-56" />
        </div>
        <Shimmer className="h-9 w-20 rounded-xl" />
      </div>
      {/* Tab bar */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className={cn('h-9 rounded-lg', i === 0 ? 'w-20' : i === 1 ? 'w-24' : 'w-16')} />
        ))}
      </div>
      {/* Content blocks */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Shimmer className="h-4 w-28" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-4/5" />
          <Shimmer className="h-3 w-3/5" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-2/3" />
        </div>
      </div>
      {/* List section */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <Shimmer className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Shimmer className="h-8 w-8 rounded-lg shrink-0" />
            <Shimmer className={cn('h-4 flex-1', i % 2 === 0 ? 'max-w-[200px]' : 'max-w-[160px]')} />
            <Shimmer className="h-4 w-16 rounded-lg" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading details...</span>
    </div>
  );
}

// ─── Portal Home Skeleton ────────────────────────────────────────────
export function PortalHomeSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading portal">
      {/* Greeting */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-36" />
        <Shimmer className="h-4 w-56" />
      </div>
      {/* Hero lesson card */}
      <div className="rounded-2xl bg-muted/60 p-6 space-y-3">
        <Shimmer className="h-3 w-28" />
        <Shimmer className="h-5 w-48" />
        <Shimmer className="h-4 w-40" />
        <Shimmer className="h-3 w-20" />
      </div>
      {/* Children cards */}
      <div className="space-y-3">
        <Shimmer className="h-4 w-24" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Shimmer className="h-9 w-9 rounded-full shrink-0" />
                <Shimmer className="h-5 w-28" />
              </div>
              <Shimmer className="h-3 w-32" />
              <Shimmer className="h-3 w-40" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading portal...</span>
    </div>
  );
}

// ─── Legacy exports (unchanged) ──────────────────────────────────────

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="flex items-center gap-4">
        <Shimmer className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-[150px]" />
          <Shimmer className="h-3 w-[200px]" />
        </div>
        <Shimmer className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Shimmer className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-4 rounded-lg" />
      </div>
      <Shimmer className="mt-3 h-8 w-16" />
      <Shimmer className="mt-2 h-3 w-20" />
    </div>
  );
}

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

export function CalendarDaySkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Shimmer key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="hidden md:flex w-60 flex-col border-r bg-sidebar p-4 gap-6">
        <div className="flex items-center gap-2 px-2">
          <Shimmer className="h-7 w-7 rounded-lg" />
          <Shimmer className="h-5 w-24" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <Shimmer className="h-4 w-4 rounded-lg" />
              <Shimmer className="h-4" style={{ width: `${60 + Math.random() * 40}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-3 border-t pt-4">
          <Shimmer className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1">
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-3 w-12" />
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4">
          <div className="flex items-center gap-3">
            <Shimmer className="h-7 w-7 rounded-lg md:hidden" />
            <Shimmer className="h-6 w-6 rounded-lg" />
            <Shimmer className="h-5 w-24 hidden sm:block" />
          </div>
          <Shimmer className="h-8 w-24 rounded-lg" />
        </div>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <DashboardSkeleton />
        </main>
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Shimmer className="h-4 w-20" />
          <Shimmer className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-4">
        <Shimmer className="h-10 w-20 rounded-lg" />
        <Shimmer className="h-10 w-24 rounded-lg" />
      </div>
      <span className="sr-only">Loading form...</span>
    </div>
  );
}
