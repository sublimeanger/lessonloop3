import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Receipt, Clock } from 'lucide-react';
import { parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import type { ChildWithDetails } from '@/hooks/useParentPortal';
import { formatCurrencyMinor, formatDateUK, formatTimeUK } from '@/lib/utils';

interface ChildCardProps {
  child: ChildWithDetails;
  currencyCode?: string;
}

export function ChildCard({ child, currencyCode = 'GBP' }: ChildCardProps) {
  const hasNextLesson = !!child.next_lesson;
  const hasBalance = child.outstanding_balance > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
              {child.first_name[0]}{child.last_name[0]}
            </div>
            <div>
              <CardTitle className="text-base">
                {child.first_name} {child.last_name}
              </CardTitle>
              <Badge 
                variant={child.status === 'active' ? 'default' : 'secondary'} 
                className="mt-1 text-xs"
              >
                {child.status}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next Lesson */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            Next Lesson
          </div>
          {hasNextLesson ? (
            <div>
              <p className="font-medium">{child.next_lesson!.title}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateUK(parseISO(child.next_lesson!.start_at), 'EEEE, d MMM')} at{' '}
                {formatTimeUK(parseISO(child.next_lesson!.start_at))}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming lessons</p>
          )}
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span>Outstanding</span>
          </div>
          <span className={`font-medium ${hasBalance ? 'text-destructive' : 'text-green-600'}`}>
            {hasBalance ? formatCurrencyMinor(child.outstanding_balance, currencyCode) : 'Paid up'}
          </span>
        </div>

        {/* Upcoming count */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Upcoming lessons</span>
          </div>
          <span className="font-medium">{child.upcoming_lesson_count}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Link to={`/portal/schedule?student=${child.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              View Schedule
            </Button>
          </Link>
          {hasBalance && (
            <Link to="/portal/invoices" className="flex-1">
              <Button size="sm" className="w-full">
                Pay Now
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
