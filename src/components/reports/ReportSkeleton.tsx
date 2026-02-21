import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Variant = 'summary-chart-table' | 'summary-table' | 'summary-chart';

interface ReportSkeletonProps {
  variant?: Variant;
}

function SummaryCards() {
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-20 mb-2" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card className="mb-6">
      <CardHeader>
        <Skeleton className="h-5 w-40 mb-1" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportSkeleton({ variant = 'summary-chart-table' }: ReportSkeletonProps) {
  return (
    <div>
      <SummaryCards />
      {(variant === 'summary-chart-table' || variant === 'summary-chart') && <ChartSkeleton />}
      {(variant === 'summary-chart-table' || variant === 'summary-table') && <TableSkeleton />}
    </div>
  );
}
