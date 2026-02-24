import { usePageMeta } from '@/hooks/usePageMeta';
import { logger } from '@/lib/logger';
import { PortalErrorState } from '@/components/portal/PortalErrorState';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { useParentSummary, useChildrenWithDetails, useGuardianInfo } from '@/hooks/useParentPortal';
import { useParentWaitlistEntries } from '@/hooks/useMakeUpWaitlist';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessages';
import { useParentCredits } from '@/hooks/useParentCredits';
import { useParentChildInstruments } from '@/hooks/useParentInstruments';
import { getInstrumentCategoryIcon } from '@/hooks/useInstruments';
import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  CreditCard,
  ChevronRight,
  MessageSquare,
  Gift,
  MapPin,
  FolderOpen,
  UserX,
  Users,
  Video,
} from 'lucide-react';
import { PortalHomeSkeleton } from '@/components/shared/LoadingState';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RequestModal } from '@/components/portal/RequestModal';
import { MakeUpStepper } from '@/components/portal/MakeUpStepper';
import { PortalWelcomeDialog } from '@/components/portal/PortalWelcomeDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { parseISO, formatDistanceToNowStrict, isBefore, isToday, isTomorrow, isAfter, addMinutes } from 'date-fns';
import { formatCurrencyMinor, formatDateUK, formatTimeUK } from '@/lib/utils';
import { cn } from '@/lib/utils';

function relativeDayLabel(dateStr: string, timezone?: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return formatDateUK(d, 'EEEE, d MMM', timezone);
}

export default function PortalHome() {
  usePageMeta('Home | Parent Portal', "Your children's music lesson overview");
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
        // Resolve guardian_id for the current user
        const { data: guardian, error: gErr } = await supabase
          .from('guardians')
          .select('id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
          .is('deleted_at', null)
          .maybeSingle();
        if (gErr) throw gErr;
        if (!guardian) {
          toast({ title: 'Guardian record not found', description: 'Please contact the academy.', variant: 'destructive' });
          return;
        }

        if (action === 'accept') {
          const { data, error } = await supabase
            .from('make_up_waitlist')
            .update({ status: 'accepted', responded_at: new Date().toISOString() })
            .eq('id', id)
            .eq('guardian_id', guardian.id)
            .eq('status', 'offered')
            .select('id');
          if (error) throw error;
          if (!data?.length) {
            toast({ title: 'Unable to accept', description: 'This offer may have expired or already been actioned.', variant: 'destructive' });
            return;
          }
          toast({ title: 'Make-up accepted! The academy will confirm the booking shortly.' });
        } else if (action === 'decline') {
          const { data, error: declineErr } = await supabase
            .from('make_up_waitlist')
            .update({
              status: 'waiting',
              responded_at: new Date().toISOString(),
              matched_lesson_id: null,
              matched_at: null,
              offered_at: null,
            })
            .eq('id', id)
            .eq('guardian_id', guardian.id)
            .eq('status', 'offered')
            .select('id');
          if (declineErr) throw declineErr;
          if (!data?.length) {
            toast({ title: 'Unable to decline', description: 'This offer may have expired or already been actioned.', variant: 'destructive' });
            return;
          }
          toast({ title: "Slot declined. We'll keep looking for another available time." });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Make-up action error:', err);
        toast({ title: 'Something went wrong', description: message, variant: 'destructive' });
      } finally {
        setSearchParams({}, { replace: true });
        queryClient.invalidateQueries({ queryKey: ['make_up_waitlist_parent'] });
      }
    };

    handleMakeupAction();
  }, [searchParams, setSearchParams, toast]);

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useParentSummary();
  const { data: children, isLoading: childrenLoading, isError: childrenError, refetch: refetchChildren } = useChildrenWithDetails();
  const { data: guardianInfo, isLoading: guardianLoading, isError: guardianError } = useGuardianInfo();
  const { data: unreadCount } = useUnreadMessagesCount();
  const { data: waitlistEntries } = useParentWaitlistEntries();
  const { data: parentCredits } = useParentCredits();
  const { data: childInstruments } = useParentChildInstruments();

  const activeWaitlist = (waitlistEntries ?? []).filter((e) =>
    ['waiting', 'matched', 'offered', 'accepted', 'booked'].includes(e.status)
  );

  const resolveGuardianId = async (): Promise<string | null> => {
    const { data: guardian, error } = await supabase
      .from('guardians')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !guardian) return null;
    return guardian.id;
  };

  const handleInlineAccept = async (id: string) => {
    const entry = activeWaitlist.find((e) => e.id === id);
    try {
      const guardianId = await resolveGuardianId();
      if (!guardianId) {
        toast({ title: 'Guardian record not found', description: 'Please contact the academy.', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase
        .from('make_up_waitlist')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', id)
        .eq('guardian_id', guardianId)
        .eq('status', 'offered')
        .select('id');
      if (error) throw error;
      if (!data?.length) {
        toast({ title: 'Unable to accept', description: 'This offer may have expired or already been actioned.', variant: 'destructive' });
        return;
      }
      const matched = entry?.matched_lesson;
      const lessonInfo = matched
        ? `${matched.title} — ${formatDateUK(parseISO(matched.start_at), 'EEEE d MMM')} at ${formatTimeUK(parseISO(matched.start_at))}`
        : '';
      toast({
        title: 'Make-up lesson accepted! 🎉',
        description: lessonInfo
          ? `${lessonInfo}. The academy will confirm your booking shortly.`
          : 'The academy will confirm the booking shortly.',
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist_parent'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Something went wrong', description: message, variant: 'destructive' });
    }
  };

  const handleInlineDecline = async (id: string) => {
    try {
      const guardianId = await resolveGuardianId();
      if (!guardianId) {
        toast({ title: 'Guardian record not found', description: 'Please contact the academy.', variant: 'destructive' });
        return;
      }
      const { data, error: declineErr } = await supabase
        .from('make_up_waitlist')
        .update({
          status: 'waiting',
          responded_at: new Date().toISOString(),
          matched_lesson_id: null,
          matched_at: null,
          offered_at: null,
        })
        .eq('id', id)
        .eq('guardian_id', guardianId)
        .eq('status', 'offered')
        .select('id');
      if (declineErr) throw declineErr;

      toast({ title: "Slot declined. We'll keep looking for another available time." });
      queryClient.invalidateQueries({ queryKey: ['make_up_waitlist_parent'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Something went wrong', description: message, variant: 'destructive' });
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const currencyCode = currentOrg?.currency_code || 'GBP';
  const tz = (currentOrg as any)?.timezone || 'Europe/London';

  const isLoading = summaryLoading || childrenLoading || guardianLoading;
  const isError = summaryError || childrenError || guardianError;

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
        {profile?.id && <PortalWelcomeDialog userId={profile.id} academyName={currentOrg?.name || 'your academy'} />}
        {/* 1. Hero Greeting */}
        <div className={cn(
          'rounded-2xl p-6 md:p-8 text-white relative overflow-hidden',
          new Date().getHours() < 12 ? 'bg-gradient-morning' :
          new Date().getHours() < 17 ? 'bg-gradient-afternoon' : 'bg-gradient-evening'
        )}>
          <div className="relative z-10">
            <p className="text-xs font-medium uppercase tracking-widest text-white/60 mb-1">
              {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Hi {firstName}! 👋
            </h1>
            <p className="text-white/70 mt-1 text-sm">
              Here's what's happening with your family's lessons.
            </p>
          </div>
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/5" />
          <div className="absolute -bottom-12 -right-4 h-40 w-40 rounded-full bg-white/[0.03]" />
        </div>

        {isLoading ? (
          <PortalHomeSkeleton />
        ) : isError ? (
          <PortalErrorState onRetry={() => { refetchSummary(); refetchChildren(); }} />
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
              <Card className="overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-card hover:shadow-elevated transition-all duration-150" role="region" aria-label="Next lesson">
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
                          {relativeDayLabel(nextLesson.start_at, tz)} at{' '}
                          {formatTimeUK(parseISO(nextLesson.start_at), tz)}
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
                    <div className="flex flex-col gap-2 shrink-0">
                      {nextLesson.online_meeting_url && (
                        <a href={nextLesson.online_meeting_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="gap-1.5 w-full">
                            <Video className="h-3.5 w-3.5" />
                            Join Online
                          </Button>
                        </a>
                      )}
                      <Link to="/portal/schedule">
                        <Button variant="secondary" size="sm" className="gap-1 w-full">
                          Schedule
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3. Children Summary */}
            {children && children.length >= 2 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Your Children
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0">
                  {children.map((child) => (
                    <Card
                      key={child.id}
                      data-interactive
                      className="min-w-[220px] snap-start sm:min-w-0 rounded-2xl overflow-hidden"
                      onClick={() => navigate(`/portal/schedule?student=${child.id}`)}
                    >
                      <CardContent className="p-4 relative">
                        {/* Left accent stripe */}
                        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-teal-dark rounded-l-2xl" />
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
                                {/* Instrument badges */}
                                {childInstruments?.[child.id] && childInstruments[child.id].length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {childInstruments[child.id].slice(0, 2).map((inst, i) => (
                                      <span key={i} className="text-micro text-muted-foreground">
                                        {getInstrumentCategoryIcon(inst.instrument_category)} {inst.instrument_name}
                                        {inst.grade_short_name ? ` ${inst.grade_short_name}` : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
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
                                {relativeDayLabel(child.next_lesson.start_at, tz)} at{' '}
                                {formatTimeUK(parseISO(child.next_lesson.start_at), tz)}
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

            {/* 3.5 Available Make-Up Credits */}
            {parentCredits && parentCredits.length > 0 && (() => {
              const totalValue = parentCredits.reduce((sum, c) => sum + c.credit_value_minor, 0);
              const now = new Date();
              const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
              const expiringSoon = parentCredits.filter(
                (c) => c.expires_at && isBefore(parseISO(c.expires_at), sevenDaysFromNow) && isAfter(parseISO(c.expires_at), now)
              );

              return (
                <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                          <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                            {parentCredits.length} make-up credit{parentCredits.length !== 1 ? 's' : ''} — {formatCurrencyMinor(totalValue, currencyCode)} available
                          </p>
                        </div>
                      </div>
                    </div>

                    {expiringSoon.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <Clock className="h-3 w-3" />
                        {expiringSoon.length} credit{expiringSoon.length !== 1 ? 's' : ''} expires{' '}
                        {formatDateUK(parseISO(expiringSoon[0].expires_at!), 'd MMM')}
                      </div>
                    )}

                    {parentCredits.length > 1 && (
                      <div className="space-y-2">
                        {parentCredits.map((credit) => (
                          <div key={credit.id} className="flex items-center justify-between text-sm border-t border-emerald-200/60 dark:border-emerald-800/60 pt-2 first:border-t-0 first:pt-0">
                            <div className="min-w-0">
                              <p className="font-medium text-emerald-900 dark:text-emerald-100">
                                {formatCurrencyMinor(credit.credit_value_minor, currencyCode)}
                                {credit.student && (
                                  <span className="text-emerald-700/70 dark:text-emerald-300/70 font-normal"> — {credit.student.first_name}</span>
                                )}
                              </p>
                              {credit.expires_at && (
                                <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60">
                                  Expires {formatDateUK(parseISO(credit.expires_at), 'd MMM yyyy')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-emerald-700/60 dark:text-emerald-400/60">
                      Credits are automatically applied when your academy creates your next invoice.
                    </p>
                  </CardContent>
                </Card>
              );
            })()}

            {/* 3.6 Make-Up Lessons */}
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
                          </div>

                          {/* Visual stepper */}
                          <MakeUpStepper status={entry.status} />

                          {/* Expiry countdown */}
                          {entry.expires_at && isBefore(new Date(), parseISO(entry.expires_at)) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires in {formatDistanceToNowStrict(parseISO(entry.expires_at))}
                            </p>
                          )}
                          {entry.expires_at && !isBefore(new Date(), parseISO(entry.expires_at)) && (
                            <p className="text-xs text-destructive font-medium">⚠️ Expired</p>
                          )}

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
              <Link to="/portal/invoices" className="block" aria-label="View invoices">
                <Card data-interactive className="border-warning/30 bg-warning/5 rounded-2xl" role="region" aria-label={`${formatCurrencyMinor(summary!.outstandingBalance, currencyCode)} outstanding`}>
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
                <Link to="/portal/messages" aria-label={`${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`}>
                  <Card data-interactive className="rounded-2xl" role="region" aria-label="Unread messages">
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
              <Card data-interactive className="rounded-2xl">
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
