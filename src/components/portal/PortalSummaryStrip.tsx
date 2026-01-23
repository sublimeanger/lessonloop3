import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Receipt, AlertCircle, MessageSquare } from 'lucide-react';
import { parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyMinor, formatDateUK, formatTimeUK } from '@/lib/utils';

interface SummaryData {
  nextLesson: {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    location_name?: string;
  } | null;
  outstandingBalance: number;
  overdueInvoices: number;
  unreadMessages: number;
}

interface PortalSummaryStripProps {
  data?: SummaryData;
  isLoading?: boolean;
  currencyCode?: string;
}

export function PortalSummaryStrip({ data, isLoading, currencyCode = 'GBP' }: PortalSummaryStripProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const hasOverdue = (data?.overdueInvoices || 0) > 0;
  const hasBalance = (data?.outstandingBalance || 0) > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {/* Next Lesson */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
            <Calendar className="h-4 w-4" />
            Next Lesson
          </div>
          {data?.nextLesson ? (
            <div>
              <p className="font-semibold truncate">{data.nextLesson.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateUK(parseISO(data.nextLesson.start_at), 'EEE, d MMM')} at{' '}
                {formatTimeUK(parseISO(data.nextLesson.start_at))}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No upcoming lessons</p>
          )}
        </CardContent>
      </Card>

      {/* Outstanding Balance */}
      <Card className={hasBalance ? 'border-amber-200 dark:border-amber-800' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
            <Receipt className="h-4 w-4" />
            Outstanding Balance
          </div>
          <p className={`text-xl font-bold ${hasBalance ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
            {hasBalance ? formatCurrencyMinor(data?.outstandingBalance || 0, currencyCode) : 'Paid up'}
          </p>
        </CardContent>
      </Card>

      {/* Overdue Invoices */}
      <Card className={hasOverdue ? 'border-destructive' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
            <AlertCircle className="h-4 w-4" />
            Overdue Invoices
          </div>
          <p className={`text-xl font-bold ${hasOverdue ? 'text-destructive' : ''}`}>
            {data?.overdueInvoices || 0}
          </p>
          {hasOverdue && (
            <p className="text-xs text-destructive">Action required</p>
          )}
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
            <MessageSquare className="h-4 w-4" />
            Messages
          </div>
          <p className="text-xl font-bold">{data?.unreadMessages || 0}</p>
          <p className="text-xs text-muted-foreground">unread</p>
        </CardContent>
      </Card>
    </div>
  );
}
