import { usePageMeta } from '@/hooks/usePageMeta';
import { useState, useMemo, useEffect } from 'react';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { PortalErrorState } from '@/components/portal/PortalErrorState';
import { useSearchParams } from 'react-router-dom';
import { useChildFilter } from '@/contexts/ChildFilterContext';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, User, CheckCircle, XCircle, AlertCircle, FileText, CalendarClock, CalendarPlus, ChevronDown, History, MoreVertical, Copy, Rss, Video, ExternalLink } from 'lucide-react';
import { parseISO, isAfter, isBefore, startOfToday, differenceInHours, startOfWeek, endOfWeek, addWeeks, isSameWeek } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useParentLessons, useCreateMessageRequest, useGuardianId } from '@/hooks/useParentPortal';
import { useOrg } from '@/contexts/OrgContext';
import { RequestModal } from '@/components/portal/RequestModal';
import { RescheduleSlotPicker } from '@/components/portal/RescheduleSlotPicker';
import { useToast } from '@/hooks/use-toast';
import { useCalendarConnections } from '@/hooks/useCalendarConnections';
import { downloadICSFile, generateGoogleCalendarUrl } from '@/lib/calendarExport';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { safeSetItem } from '@/lib/storage';

// --- Types ---
type Lesson = NonNullable<ReturnType<typeof useParentLessons>['data']>[number];

interface WeekGroup {
  label: string;
  lessons: Lesson[];
}

export default function PortalSchedule() {
  usePageMeta('Schedule | Parent Portal', 'View and manage lesson schedule');
  const { user } = useAuth();
  useEffect(() => {
    if (user?.id) safeSetItem(`ll-parent-visited-schedule-${user.id}`, 'true');
  }, [user?.id]);
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedChildId } = useChildFilter();
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<{ id: string; title: string } | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [calSyncOpen, setCalSyncOpen] = useState(false);
  const [icalUrl, setIcalUrl] = useState<string | null>(null);
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);

  // Reschedule slot picker state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleLesson, setRescheduleLesson] = useState<{
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    teacher_id: string | null;
  } | null>(null);

  const { currentOrg } = useOrg();
  const tz = (currentOrg as any)?.timezone || 'Europe/London';
  const { toast } = useToast();
  const { generateParentICalUrl } = useCalendarConnections();
  const { guardianId } = useGuardianId();

  const handleGenerateICalUrl = async () => {
    if (!guardianId) return;
    setIsGeneratingUrl(true);
    const url = await generateParentICalUrl(guardianId);
    if (url) {
      setIcalUrl(url);
      const webcalUrl = url.replace(/^https?:\/\//, 'webcal://');
      window.open(webcalUrl, '_self');
    } else {
      toast({ title: 'Failed to generate feed URL', variant: 'destructive' });
    }
    setIsGeneratingUrl(false);
  };

  const handleCopyICalUrl = async () => {
    if (!guardianId) return;
    setIsGeneratingUrl(true);
    const url = icalUrl || await generateParentICalUrl(guardianId);
    setIsGeneratingUrl(false);
    if (url) {
      setIcalUrl(url);
      await navigator.clipboard.writeText(url);
      toast({ title: 'Feed URL copied to clipboard' });
    } else {
      toast({ title: 'Failed to generate feed URL', variant: 'destructive' });
    }
  };

  // Fetch ALL lessons (no status filter — cancelled shown inline)
  const { data: lessons, isLoading, isError, refetch } = useParentLessons({
    studentId: selectedChildId || undefined,
  });
  const createRequest = useCreateMessageRequest();

  // Reschedule policy
  const reschedulePolicy = currentOrg?.parent_reschedule_policy || 'request_only';
  const canReschedule = reschedulePolicy !== 'admin_locked';
  const showSlotPicker = reschedulePolicy === 'self_service';

  const handleRequestChange = (lesson: { id: string; title: string }) => {
    setSelectedLesson(lesson);
    setRequestModalOpen(true);
  };

  const handleRescheduleClick = (lesson: {
    id: string; title: string; start_at: string; end_at: string; teacher_id: string | null;
  }) => {
    setRescheduleLesson(lesson);
    setRescheduleModalOpen(true);
  };

  const isWithinNoticeWindow = (startAt: string): boolean => {
    const noticeHours = currentOrg?.cancellation_notice_hours || 24;
    return differenceInHours(parseISO(startAt), new Date()) < noticeHours;
  };

  const handleSlotSelect = async (slot: { proposedStart: Date; proposedEnd: Date }) => {
    if (!rescheduleLesson || !currentOrg) return;
    const isLate = isWithinNoticeWindow(rescheduleLesson.start_at);
    try {
      await createRequest.mutateAsync({
        request_type: 'reschedule',
        subject: `Reschedule Request: ${rescheduleLesson.title}`,
        message: `I would like to reschedule my lesson from ${formatInTimeZone(parseISO(rescheduleLesson.start_at), tz, 'EEEE, d MMMM \'at\' HH:mm')} to:\n\n**Proposed new time:** ${formatInTimeZone(slot.proposedStart, tz, 'EEEE, d MMMM \'at\' HH:mm')} - ${formatInTimeZone(slot.proposedEnd, tz, 'HH:mm')}\n\n${isLate ? '⚠️ Note: This is a late cancellation request.' : ''}`,
        lesson_id: rescheduleLesson.id,
      });
      toast({ title: 'Reschedule request sent', description: 'The admin will review and confirm your new time.' });
      setRescheduleModalOpen(false);
      setRescheduleLesson(null);
    } catch {
      toast({ title: 'Failed to send request', description: 'Please try again or contact support.', variant: 'destructive' });
    }
  };

  // --- Group lessons ---
  const today = startOfToday();
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const { thisWeekLessons, futureWeekGroups, pastLessons, attendanceSummary } = useMemo(() => {
    if (!lessons) return { thisWeekLessons: [], futureWeekGroups: [], pastLessons: [], attendanceSummary: [] };

    const thisWeek: Lesson[] = [];
    const future: Lesson[] = [];
    const past: Lesson[] = [];

    for (const l of lessons) {
      const d = parseISO(l.start_at);
      if (isBefore(d, thisWeekStart)) {
        past.push(l);
      } else if (!isAfter(d, thisWeekEnd)) {
        thisWeek.push(l);
      } else {
        future.push(l);
      }
    }

    // Group future by week
    const weekMap = new Map<string, WeekGroup>();
    for (const l of future) {
      const d = parseISO(l.start_at);
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const key = ws.toISOString();
      if (!weekMap.has(key)) {
        const isNextWeek = isSameWeek(ws, addWeeks(today, 1), { weekStartsOn: 1 });
        const label = isNextWeek
          ? `Next Week — ${formatInTimeZone(ws, tz, 'd MMM')}`
          : `Week of ${formatInTimeZone(ws, tz, 'd MMM')}`;
        weekMap.set(key, { label, lessons: [] });
      }
      weekMap.get(key)!.lessons.push(l);
    }

    // Build attendance summary per child from past lessons
    const childMap = new Map<string, { name: string; present: number; late: number; absent: number; total: number }>();
    for (const l of past) {
      for (const s of l.students) {
        if (!s.attendance_status) continue;
        if (!childMap.has(s.id)) {
          childMap.set(s.id, { name: `${s.first_name} ${s.last_name}`, present: 0, late: 0, absent: 0, total: 0 });
        }
        const entry = childMap.get(s.id)!;
        entry.total++;
        if (s.attendance_status === 'present') entry.present++;
        else if (s.attendance_status === 'late') entry.late++;
        else if (s.attendance_status === 'absent') entry.absent++;
      }
    }

    return {
      thisWeekLessons: thisWeek,
      futureWeekGroups: Array.from(weekMap.values()),
      pastLessons: past.sort((a, b) => parseISO(b.start_at).getTime() - parseISO(a.start_at).getTime()),
      attendanceSummary: Array.from(childMap.values()),
    };
  }, [lessons, thisWeekStart, thisWeekEnd, today, tz]);

  // --- Badge helpers ---
  const getStatusBadge = (status: string) => {
    if (status === 'cancelled') return <Badge variant="destructive">Cancelled</Badge>;
    if (status === 'completed') return <Badge variant="secondary">Completed</Badge>;
    return null; // scheduled lessons don't need a badge in the new design
  };

  const getAttendanceBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'present':
        return (
          <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
            <CheckCircle className="h-3 w-3" /> Present
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Absent
          </Badge>
        );
      case 'late':
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" /> Late
          </Badge>
        );
      default:
        return null;
    }
  };

  // --- Lesson Card ---
  const LessonCard = ({ lesson, isPast }: { lesson: Lesson; isPast?: boolean }) => {
    const isCancelled = lesson.status === 'cancelled';

    const accentColor = isCancelled ? 'bg-destructive' : isPast ? 'bg-muted-foreground/30' : 'bg-success';
    
    return (
      <Card className={cn('overflow-hidden rounded-2xl shadow-card hover:shadow-elevated transition-all duration-150 relative', isCancelled && 'opacity-60')}>
        {/* Left accent bar */}
        <div className={cn('absolute inset-y-0 left-0 w-1 rounded-l-2xl', accentColor)} />
        <CardContent className="p-4 pl-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className={cn('font-medium truncate', isCancelled && 'line-through')}>
                  {lesson.title}
                </h3>
                {getStatusBadge(lesson.status)}
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>{formatInTimeZone(parseISO(lesson.start_at), tz, 'EEEE, d MMMM yyyy')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {formatInTimeZone(parseISO(lesson.start_at), tz, 'HH:mm')} - {formatInTimeZone(parseISO(lesson.end_at), tz, 'HH:mm')}
                  </span>
                </div>
                {lesson.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span>{lesson.location.name}</span>
                  </div>
                )}
                {lesson.teacher_name && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 flex-shrink-0" />
                    <span>{lesson.teacher_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 flex-shrink-0" />
                  <span>{lesson.students.map(s => `${s.first_name} ${s.last_name}`).join(', ')}</span>
                </div>
              </div>

              {/* Attendance */}
              {isPast && lesson.students.some(s => s.attendance_status) && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Attendance</p>
                  <div className="flex flex-wrap gap-2">
                    {lesson.students.map((student) => (
                      <div key={student.id} className="flex items-center gap-1.5">
                        <span className="text-sm">{student.first_name}:</span>
                        {getAttendanceBadge(student.attendance_status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shared notes */}
              {lesson.notes_shared && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                    <FileText className="h-3.5 w-3.5" /> Lesson Notes
                  </div>
                  <p className="text-sm bg-muted/50 p-2.5 rounded-md whitespace-pre-wrap">{lesson.notes_shared}</p>
                </div>
              )}

              {/* Recap Link */}
              {lesson.recap_url && (
                <div className="mt-3 pt-3 border-t">
                  <a
                    href={lesson.recap_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm font-medium text-primary hover:bg-muted transition-colors"
                    style={{ minHeight: 44 }}
                  >
                    <Video className="h-4 w-4 shrink-0" />
                    Watch Recap
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
                </div>
              )}
            </div>

            {lesson.status === 'scheduled' && !isPast && (
              <>
                {/* Mobile: single "more" menu */}
                <div className="sm:hidden">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Lesson actions">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => window.open(generateGoogleCalendarUrl(lesson, tz), '_blank', 'noopener,noreferrer')}>
                        Add to Google Calendar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadICSFile(lesson, tz)}>
                        Download .ics
                      </DropdownMenuItem>
                      {canReschedule && (
                        <DropdownMenuItem
                          onClick={() => showSlotPicker
                            ? handleRescheduleClick({ id: lesson.id, title: lesson.title, start_at: lesson.start_at, end_at: lesson.end_at, teacher_id: lesson.teacher_id })
                            : handleRequestChange({ id: lesson.id, title: lesson.title })
                          }
                        >
                          {showSlotPicker ? 'Reschedule' : 'Request Change'}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Desktop: separate buttons */}
                <div className="hidden sm:flex flex-col gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1" aria-label="Add to calendar">
                        <CalendarPlus className="h-4 w-4" />
                        Add to Cal
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => window.open(generateGoogleCalendarUrl(lesson, tz), '_blank', 'noopener,noreferrer')}>
                        Google Calendar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadICSFile(lesson, tz)}>
                        Apple / Outlook (.ics)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {canReschedule && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      aria-label={showSlotPicker ? 'Reschedule lesson' : 'Request change'}
                      onClick={() => showSlotPicker
                        ? handleRescheduleClick({ id: lesson.id, title: lesson.title, start_at: lesson.start_at, end_at: lesson.end_at, teacher_id: lesson.teacher_id })
                        : handleRequestChange({ id: lesson.id, title: lesson.title })
                      }
                    >
                      <CalendarClock className="h-4 w-4" />
                      {showSlotPicker ? 'Reschedule' : 'Request Change'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // --- Render ---
  return (
    <PortalLayout>
      <PageHeader title="Schedule" description="View your children's lesson schedule" />

      {/* Calendar Subscribe Card */}
      {guardianId && (
        <Card className="mb-6">
          <CardHeader
            className="cursor-pointer py-3 px-4"
            onClick={() => setCalSyncOpen(!calSyncOpen)}
          >
            <CardTitle className="text-sm flex items-center gap-2">
              <Rss className="h-4 w-4" />
              Subscribe to Calendar Feed
              <Badge variant="secondary" className="ml-auto text-micro">New</Badge>
              <ChevronDown className={cn('h-4 w-4 transition-transform', calSyncOpen && 'rotate-180')} />
            </CardTitle>
          </CardHeader>
          {calSyncOpen && (
            <CardContent className="space-y-3 pt-0">
              <p className="text-sm text-muted-foreground">
                Get your children's lesson schedule in your phone's calendar app.
                Lessons update automatically — no need to check the portal.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleGenerateICalUrl} disabled={isGeneratingUrl}>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Apple Calendar / iCal
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopyICalUrl} disabled={isGeneratingUrl}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Feed URL
                </Button>
              </div>
              {icalUrl && (
                <div className="mt-2">
                  <Input value={icalUrl} readOnly className="text-xs font-mono" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste this URL in any calendar app: Subscribe to calendar / Add by URL
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : isError ? (
        <PortalErrorState onRetry={() => refetch()} />
      ) : !lessons || lessons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-medium">No lessons found</h3>
            <p className="mt-1 text-sm text-muted-foreground">No lessons scheduled yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* This Week */}
          <div>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              This Week
              <span className="flex-1 h-px bg-border ml-3" />
            </h2>
            {thisWeekLessons.length > 0 ? (
              <div className="space-y-3">
                {thisWeekLessons.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} isPast={false} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No lessons this week.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Future weeks */}
          {futureWeekGroups.map((group) => (
            <div key={group.label}>
              <h2 className="text-base font-bold mb-3 text-muted-foreground flex items-center gap-2">{group.label}<span className="flex-1 h-px bg-border ml-2" /></h2>
              <div className="space-y-3">
                {group.lessons.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} isPast={false} />
                ))}
              </div>
            </div>
          ))}

          {/* Past Lessons — collapsible */}
          {pastLessons.length > 0 && (
            <div className="space-y-4">
              {/* Attendance Summary */}
              {attendanceSummary.length > 0 && pastOpen && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Attendance Summary
                    </h3>
                    <div className="space-y-2.5">
                      {attendanceSummary.map((child) => {
                        const pct = child.total > 0 ? Math.round(((child.present + child.late) / child.total) * 100) : 0;
                        return (
                          <div key={child.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="font-medium">{child.name}</span>
                            <span className="text-muted-foreground">—</span>
                            <span className="font-semibold">{child.present + child.late}/{child.total} ({pct}%)</span>
                            <div className="flex items-center gap-3 ml-auto">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-primary inline-block" />
                                <Badge variant="outline" className="text-xs px-1.5 py-0">{child.present}</Badge>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-warning inline-block" />
                                <Badge variant="outline" className="text-xs px-1.5 py-0">{child.late}</Badge>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
                                <Badge variant="outline" className="text-xs px-1.5 py-0">{child.absent}</Badge>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground gap-2">
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Past Lessons ({pastLessons.length})
                    </span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', pastOpen && 'rotate-180')} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3">
                  {pastLessons.map((lesson) => (
                    <LessonCard key={lesson.id} lesson={lesson} isPast={true} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      )}

      <RequestModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        defaultType="reschedule"
        lessonId={selectedLesson?.id}
        lessonTitle={selectedLesson?.title}
      />

      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className="max-h-[100dvh] h-full sm:h-auto sm:max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
          </DialogHeader>
          {rescheduleLesson && currentOrg && (
            <RescheduleSlotPicker
              lessonId={rescheduleLesson.id}
              lessonTitle={rescheduleLesson.title}
              originalStart={rescheduleLesson.start_at}
              originalEnd={rescheduleLesson.end_at}
              teacherId={rescheduleLesson.teacher_id}
              orgId={currentOrg.id}
              onSlotSelect={handleSlotSelect}
              onCancel={() => { setRescheduleModalOpen(false); setRescheduleLesson(null); }}
              isLateCancel={isWithinNoticeWindow(rescheduleLesson.start_at)}
              cancellationNoticeHours={currentOrg.cancellation_notice_hours || 24}
            />
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
