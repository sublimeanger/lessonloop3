import { PortalLayout } from '@/components/layout/PortalLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useParentSummary, useChildrenWithDetails } from '@/hooks/useParentPortal';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessages';
import {
  Calendar,
  Clock,
  CreditCard,
  ChevronRight,
  MessageSquare,
  MapPin,
} from 'lucide-react';
import { PortalHomeSkeleton } from '@/components/shared/LoadingState';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RequestModal } from '@/components/portal/RequestModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseISO, formatDistanceToNowStrict, isBefore, isToday, isTomorrow } from 'date-fns';
import { formatCurrencyMinor, formatDateUK, formatTimeUK } from '@/lib/utils';

function relativeDayLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return formatDateUK(d, 'EEEE, d MMM');
}

export default function PortalHome() {
  const { profile } = useAuth();
  const { currentOrg } = useOrg();
  const navigate = useNavigate();
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useParentSummary();
  const { data: children, isLoading: childrenLoading } = useChildrenWithDetails();
  const { data: unreadCount } = useUnreadMessagesCount();

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const currencyCode = currentOrg?.currency_code || 'GBP';

  const isLoading = summaryLoading || childrenLoading;

  // Derive the overall "next lesson" from summary or children
  const nextLesson = summary?.nextLesson;
  // Find which child this next lesson belongs to
  const nextLessonChild = children?.find(
    (c) => c.next_lesson && c.next_lesson.id === nextLesson?.id,
  );

  const hasOutstanding = (summary?.outstandingBalance || 0) > 0;
  const overdueCount = summary?.overdueInvoices || 0;

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* 1. Greeting */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Hi {firstName}! 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Here's what's happening with your family's lessons.
          </p>
        </div>

        {isLoading ? (
          <PortalHomeSkeleton />
        ) : (
          <>
            {/* 2. Next Lesson Hero Card */}
            {nextLesson && (
              <Card className="overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-md">
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      {nextLessonChild && (
                        <p className="text-xs font-medium uppercase tracking-wider text-primary/70">
                          {nextLessonChild.first_name}'s next lesson
                        </p>
                      )}
                      <h2 className="text-lg font-semibold truncate">
                        {nextLesson.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {relativeDayLabel(nextLesson.start_at)} at{' '}
                          {formatTimeUK(parseISO(nextLesson.start_at))}
                        </span>
                        {(nextLesson as any).location_name && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {(nextLesson as any).location_name}
                          </span>
                        )}
                      </div>
                      {/* Countdown */}
                      {!isBefore(parseISO(nextLesson.start_at), new Date()) && (
                        <p className="text-xs font-medium text-primary mt-1 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          in {formatDistanceToNowStrict(parseISO(nextLesson.start_at))}
                        </p>
                      )}
                    </div>
                    <Link to="/portal/schedule" className="shrink-0">
                      <Button variant="secondary" size="sm" className="gap-1">
                        Schedule
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3. Children Summary */}
            {children && children.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Your Children
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {children.map((child) => (
                    <Card
                      key={child.id}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
                      onClick={() => navigate(`/portal/schedule?student=${child.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2 min-w-0 flex-1">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                                {child.first_name[0]}
                                {child.last_name[0]}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold truncate">
                                  {child.first_name} {child.last_name}
                                </h3>
                              </div>
                            </div>

                            {/* Stats row */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {child.upcoming_lesson_count} upcoming
                              </span>
                              {child.outstanding_balance > 0 && (
                                <span className="text-warning font-medium">
                                  {formatCurrencyMinor(child.outstanding_balance, currencyCode)} due
                                </span>
                              )}
                            </div>

                            {/* Next lesson */}
                            {child.next_lesson && (
                              <p className="text-xs text-muted-foreground">
                                Next:{' '}
                                {relativeDayLabel(child.next_lesson.start_at)} at{' '}
                                {formatTimeUK(parseISO(child.next_lesson.start_at))}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-3" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Outstanding Balance */}
            {hasOutstanding && (
              <Link to="/portal/invoices" className="block">
                <Card className="border-warning/30 bg-warning/5 transition-all hover:shadow-md hover:border-warning/50">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-warning/10 shrink-0">
                        <CreditCard className="h-4 w-4 text-warning" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">
                          {formatCurrencyMinor(summary!.outstandingBalance, currencyCode)} outstanding
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {overdueCount > 0
                            ? `${overdueCount} overdue invoice${overdueCount !== 1 ? 's' : ''}`
                            : 'View invoices'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* 5. Recent Messages */}
            {(unreadCount || 0) > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Messages
                  </h2>
                  <Link
                    to="/portal/messages"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    View all <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <Link to="/portal/messages">
                  <Card className="transition-all hover:shadow-md">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tap to view your messages
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              </div>
            )}

            {/* Quick action */}
            <div className="pt-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setRequestModalOpen(true)}
              >
                <MessageSquare className="h-4 w-4" />
                Send a Message
              </Button>
            </div>
          </>
        )}
      </div>

      <RequestModal open={requestModalOpen} onOpenChange={setRequestModalOpen} />
    </PortalLayout>
  );
}
