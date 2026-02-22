import { logger } from '@/lib/logger';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useParentSummary, useChildrenWithDetails, useGuardianInfo } from '@/hooks/useParentPortal';
import { useParentWaitlistEntries } from '@/hooks/useMakeUpWaitlist';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessages';
import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  CreditCard,
  ChevronRight,
  MessageSquare,
  MapPin,
  FolderOpen,
  UserX,
  Users,
} from 'lucide-react';
import { PortalHomeSkeleton } from '@/components/shared/LoadingState';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RequestModal } from '@/components/portal/RequestModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { parseISO, formatDistanceToNowStrict, isBefore, isToday, isTomorrow, isAfter, addMinutes } from 'date-fns';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const makeupHandled = useRef(false);

  // Handle make-up accept/decline from email links
  useEffect(() => {
    const action = searchParams.get('makeup_action');
    const id = searchParams.get('id');
    if (!action || !id || makeupHandled.current) return;
    makeupHandled.current = true;

    const handleMakeupAction = async () => {
      try {
        if (action === 'accept') {
          const { error } = await supabase
            .from('make_up_waitlist')
            .update({ status: 'accepted', responded_at: new Date().toISOString() })
            .eq('id', id);
          if (error) throw error;
          toast({ title: 'Make-up accepted! The academy will confirm the booking shortly.' });
        } else if (action === 'decline') {
          // Mark as declined first
          const { error: declineErr } = await supabase
            .from('make_up_waitlist')
            .update({ status: 'declined', responded_at: new Date().toISOString() })
            .eq('id', id);
          if (declineErr) throw declineErr;

          // Reset to waiting so the system can re-match
          const { error: resetErr } = await supabase
            .from('make_up_waitlist')
            .update({
              status: 'waiting',
              matched_lesson_id: null,
              matched_at: null,
              offered_at: null,
            })
            .eq('id', id);
          if (resetErr) throw resetErr;
          toast({ title: "Slot declined. We'll keep looking for another available time." });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Make-up action error:', err);
        toast({ title: 'Something went wrong', description: message, variant: 'destructive' });
      } finally {
        // Clean URL params
        setSearchParams({}, { replace: true });
        queryClient.invalidateQueries({ queryKey: ['make_up_waitlist_parent'] });
      }
    };

    handleMakeupAction();
  }, [searchParams, setSearchParams, toast]);

  const { data: summary, isLoading: summaryLoading } = useParentSummary();
  const { data: children, isLoading: childrenLoading } = useChildrenWithDetails();
  const { data: guardianInfo, isLoading: guardianLoading } = useGuardianInfo();
  const { data: unreadCount } = useUnreadMessagesCount();
  const { data: waitlistEntries } = useParentWaitlistEntries();

  const activeWaitlist = (waitlistEntries ?? []).filter((e) =>
    ['waiting', 'matched', 'offered', 'accepted', 'booked'].includes(e.status)
  );

  const handleInlineAccept = async (id: string) => {
    try {
      const { error } = await supabase
        .from('make_up_waitlist')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Make-up accepted! The academy will confirm the booking shortly.' });
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist_parent'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Something went wrong', description: message, variant: 'destructive' });
    }
  };

  const handleInlineDecline = async (id: string) => {
    try {
      const { error: declineErr } = await supabase
        .from('make_up_waitlist')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', id);
      if (declineErr) throw declineErr;

      const { error: resetErr } = await supabase
        .from('make_up_waitlist')
        .update({ status: 'waiting', matched_lesson_id: null, matched_at: null, offered_at: null })
        .eq('id', id);
      if (resetErr) throw resetErr;

      toast({ title: "Slot declined. We'll keep looking for another available time." });
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist_parent'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Something went wrong', description: message, variant: 'destructive' });
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const currencyCode = currentOrg?.currency_code || 'GBP';

  const isLoading = summaryLoading || childrenLoading || guardianLoading;

  const allChildrenInactive = children && children.length > 0 && children.every(c => c.status === 'inactive');
  const noLinkedChildren = !childrenLoading && (!children || children.length === 0);
  const noGuardianRecord = !guardianLoading && !guardianInfo;
  const hasAccessIssue = noGuardianRecord || noLinkedChildren || allChildrenInactive;

  const academyName = currentOrg?.name || 'your academy';
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
        ) : hasAccessIssue ? (
          <Card className="border-muted">
            <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
              {noGuardianRecord ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <UserX className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold">Account Not Linked</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Your account isn't linked to any children yet. Please contact {academyName} if you need help getting set up.
                    </p>
                  </div>
                </>
              ) : noLinkedChildren ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold">No Students Found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      No active students are linked to your account. Contact {academyName} for assistance.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold">Enrolments Inactive</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      All your children's enrolments are currently inactive. Reach out to {academyName} if you believe this is an error.
                    </p>
                  </div>
                </>
              )}
              <Button variant="outline" className="gap-2" onClick={() => setRequestModalOpen(true)}>
                <MessageSquare className="h-4 w-4" />
                Send a Message
              </Button>
            </CardContent>
          </Card>
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
                        {nextLesson.location_name && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {nextLesson.location_name}
                          </span>
                        )}
                      </div>
                      {/* Countdown */}
                      {isAfter(parseISO(nextLesson.start_at), addMinutes(new Date(), 1)) && (
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

            {/* 3.5 Make-Up Lessons */}
            {activeWaitlist.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  🎵 Make-Up Lessons
                </h2>
                <div className="space-y-3">
                  {activeWaitlist.map((entry) => {
                    const studentName = entry.student
                      ? `${entry.student.first_name} ${entry.student.last_name}`
                      : 'Student';
                    const missedDate = formatDateUK(parseISO(entry.missed_lesson_date), 'd MMM');
                    const matched = entry.matched_lesson;

                    return (
                      <Card
                        key={entry.id}
                        className={
                          entry.status === 'offered'
                            ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                            : ''
                        }
                      >
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">
                                {studentName} — {entry.lesson_title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Missed {missedDate} · Waiting {formatDistanceToNowStrict(parseISO(entry.created_at || entry.missed_lesson_date))}
                              </p>
                            </div>
                            {entry.status === 'waiting' && (
                              <Badge variant="secondary" className="shrink-0 text-xs">⏳ Awaiting slot</Badge>
                            )}
                            {entry.status === 'matched' && (
                              <Badge variant="secondary" className="shrink-0 text-xs text-blue-600 dark:text-blue-400">🔍 Being reviewed</Badge>
                            )}
                            {entry.status === 'accepted' && (
                              <Badge variant="secondary" className="shrink-0 text-xs text-green-600 dark:text-green-400">✅ Accepted</Badge>
                            )}
                            {entry.status === 'booked' && (
                              <Badge variant="secondary" className="shrink-0 text-xs text-green-700 dark:text-green-300">📅 Booked</Badge>
                            )}
                          </div>

                          {/* Offered: show lesson details + buttons */}
                          {entry.status === 'offered' && matched && (
                            <div className="space-y-3 pt-1">
                              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-white dark:bg-background p-3 space-y-1 text-sm">
                                <p className="font-medium">{matched.title}</p>
                                <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                                  <Calendar className="h-3 w-3" />
                                  {formatDateUK(parseISO(matched.start_at), 'EEEE d MMM')} at {formatTimeUK(parseISO(matched.start_at))}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => handleInlineAccept(entry.id)}
                                >
                                  ✅ Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleInlineDecline(entry.id)}
                                >
                                  Decline
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">⏰ Please respond within 48 hours</p>
                            </div>
                          )}

                          {/* Booked: show the booked lesson date */}
                          {entry.status === 'booked' && entry.booked_lesson_id && matched && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              📅 {formatDateUK(parseISO(matched.start_at), 'EEEE d MMM')} at {formatTimeUK(parseISO(matched.start_at))}
                            </p>
                          )}

                          {entry.status === 'accepted' && (
                            <p className="text-xs text-muted-foreground">Awaiting confirmation from your academy</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
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
            <Link to="/portal/resources" className="block">
              <Card className="transition-all hover:shadow-md">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Resources</p>
                    <p className="text-xs text-muted-foreground">Teaching materials from your teacher</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          </>
        )}
      </div>

      <RequestModal open={requestModalOpen} onOpenChange={setRequestModalOpen} />
    </PortalLayout>
  );
}
