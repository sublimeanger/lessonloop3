import { useState, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { logger } from '@/lib/logger';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { useSearchParams } from 'react-router-dom';
import { format, addWeeks, subWeeks, startOfWeek, addDays, parseISO } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendarData, useTeachersAndLocations } from '@/hooks/useCalendarData';
import { WeekTimeGrid } from '@/components/calendar/WeekTimeGrid';
import { AgendaView } from '@/components/calendar/AgendaView';
import { StackedWeekView } from '@/components/calendar/StackedWeekView';
import { DayTimelineView } from '@/components/calendar/DayTimelineView';
import { MobileDayView } from '@/components/calendar/MobileDayView';
import { MobileLessonSheet } from '@/components/calendar/MobileLessonSheet';
import { WeekContextStrip } from '@/components/calendar/WeekContextStrip';
import { useIsMobile } from '@/hooks/use-mobile';
import { LessonModal } from '@/components/calendar/LessonModal';
import { LessonDetailPanel } from '@/components/calendar/LessonDetailPanel';
import { LessonDetailSidePanel } from '@/components/calendar/LessonDetailSidePanel';
import { getTeacherColour } from '@/components/calendar/teacherColours';
import { CalendarFiltersBar } from '@/components/calendar/CalendarFiltersBar';
import { MarkDayCompleteButton } from '@/components/calendar/MarkDayCompleteButton';
import { RecurringActionDialog, RecurringActionMode } from '@/components/calendar/RecurringActionDialog';
import { CalendarView, CalendarFilters, LessonWithDetails } from '@/components/calendar/types';
import { buildTeacherColourMap } from '@/components/calendar/teacherColours';
import { QuickCreatePopover } from '@/components/calendar/QuickCreatePopover';
import { ContextualHint } from '@/components/shared/ContextualHint';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Plus, List, LayoutGrid, Loader2, Columns3, Minimize2, Users, AlertTriangle, Calendar } from 'lucide-react';
import { CalendarSkeleton } from '@/components/shared/LoadingState';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const LG_QUERY = '(min-width: 1024px)';
const subscribe = (cb: () => void) => { const mql = window.matchMedia(LG_QUERY); mql.addEventListener('change', cb); return () => mql.removeEventListener('change', cb); };
const getSnapshot = () => window.matchMedia(LG_QUERY).matches;
function useIsDesktop() { return useSyncExternalStore(subscribe, getSnapshot, () => true); }

export default function CalendarPage() {
  const { currentRole, currentOrg } = useOrg();
  const { user } = useAuth();
  const isParent = currentRole === 'parent';
  const { teachers, locations, rooms } = useTeachersAndLocations();
  const [searchParams] = useSearchParams();
  const { checkConflicts } = useConflictDetection();
  const { isOnline } = useOnlineStatus();
  const isMobile = useIsMobile();

  // Calendar state
  const [currentDate, setCurrentDate] = useState(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? new Date(dateParam) : new Date();
  });
  const [view, setView] = useState<CalendarView>('day');
  const [isCompact, setIsCompact] = useState(() => {
    return safeGetItem('ll-calendar-compact') === '1';
  });
  const [groupByTeacher, setGroupByTeacher] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>(() => ({
    teacher_id: searchParams.get('teacher') || null,
    location_id: null,
    room_id: null,
  }));

  // Persist compact preference
  useEffect(() => {
    safeSetItem('ll-calendar-compact', isCompact ? '1' : '0');
  }, [isCompact]);

  // Lesson modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonWithDetails | null>(null);
  const [slotDate, setSlotDate] = useState<Date | undefined>(undefined);
  const [slotEndDate, setSlotEndDate] = useState<Date | undefined>(undefined);

  // Detail panel state
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [detailLesson, setDetailLesson] = useState<LessonWithDetails | null>(null);

  // Side panel state (desktop lg+)
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelLesson, setSidePanelLesson] = useState<LessonWithDetails | null>(null);
  const isDesktop = useIsDesktop();

  // Mobile lesson sheet state
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileSheetLesson, setMobileSheetLesson] = useState<LessonWithDetails | null>(null);

  // Quick-create popover state
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateStart, setQuickCreateStart] = useState<Date>(new Date());
  const [quickCreateEnd, setQuickCreateEnd] = useState<Date | undefined>(undefined);

  // Drag reschedule / resize state for recurring dialog
  const [pendingDrag, setPendingDrag] = useState<{
    lesson: LessonWithDetails;
    newStart: Date;
    newEnd: Date;
    type: 'move' | 'resize';
  } | null>(null);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);

  // Fetch lessons
  const { lessons, setLessons, isLoading, isCapReached, refetch } = useCalendarData(currentDate, view, filters);

  // Track lesson IDs that are currently being saved (optimistic update in flight)
  const [savingLessonIds, setSavingLessonIds] = useState<Set<string>>(new Set());

  // Lessons grouped by day for the week strip
  const lessonsByDay = useMemo(() => {
    const map = new Map<string, LessonWithDetails[]>();
    for (const lesson of lessons) {
      const key = format(parseISO(lesson.start_at), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(lesson);
      map.set(key, arr);
    }
    return map;
  }, [lessons]);

  // Teacher colour map
  const teacherColourMap = useMemo(() => buildTeacherColourMap(teachers), [teachers]);
  const teachersWithColours = useMemo(
    () => Array.from(teacherColourMap.values()),
    [teacherColourMap]
  );

  // Navigation — always by week
  const navigatePrev = () => setCurrentDate(subWeeks(currentDate, 1));
  const navigateNext = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Keyboard navigation
  useEffect(() => {
    const handleCalendarToday = () => goToToday();
    const handleCalendarPrev = () => navigatePrev();
    const handleCalendarNext = () => navigateNext();
    const handleCalendarNewLesson = () => {
      if (!isParent) {
        setSelectedLesson(null);
        setSlotDate(undefined);
        setSlotEndDate(undefined);
        setIsModalOpen(true);
      }
    };
    const handleCalendarViewWeek = () => setView('week');
    const handleCalendarViewStacked = () => setView('stacked');

    window.addEventListener('calendar-today', handleCalendarToday);
    window.addEventListener('calendar-prev', handleCalendarPrev);
    window.addEventListener('calendar-next', handleCalendarNext);
    window.addEventListener('calendar-new-lesson', handleCalendarNewLesson);
    window.addEventListener('calendar-view-week', handleCalendarViewWeek);
    window.addEventListener('calendar-view-stacked', handleCalendarViewStacked);

    return () => {
      window.removeEventListener('calendar-today', handleCalendarToday);
      window.removeEventListener('calendar-prev', handleCalendarPrev);
      window.removeEventListener('calendar-next', handleCalendarNext);
      window.removeEventListener('calendar-new-lesson', handleCalendarNewLesson);
      window.removeEventListener('calendar-view-week', handleCalendarViewWeek);
      window.removeEventListener('calendar-view-stacked', handleCalendarViewStacked);
    };
  }, [currentDate, view, isParent]);

  // Handle ?action=new query param from command palette
  useEffect(() => {
    if (searchParams.get('action') === 'new' && !isParent && !isModalOpen) {
      setSelectedLesson(null);
      setSlotDate(undefined);
      setSlotEndDate(undefined);
      setIsModalOpen(true);
      
      // Clean up URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      window.history.replaceState(null, '', `?${newParams.toString()}`);
    }
  }, [searchParams, isParent, isModalOpen]);

  // ─── Core handlers ─────────────────────────────────────────
  const handleLessonClick = useCallback((lesson: LessonWithDetails) => {
    if (isMobile) {
      setMobileSheetLesson(lesson);
      setMobileSheetOpen(true);
    } else if (isDesktop) {
      setSidePanelLesson(lesson);
      setSidePanelOpen(true);
    } else {
      setDetailLesson(lesson);
      setDetailPanelOpen(true);
    }
  }, [isDesktop, isMobile]);

  const handleSlotClick = useCallback((date: Date) => {
    if (isParent) return;
    setQuickCreateStart(date);
    setQuickCreateEnd(undefined);
    setQuickCreateOpen(true);
  }, [isParent]);

  const handleSlotDrag = useCallback((start: Date, end: Date) => {
    if (isParent) return;
    setQuickCreateStart(start);
    setQuickCreateEnd(end);
    setQuickCreateOpen(true);
  }, [isParent]);

  const handleQuickCreateOpenFullModal = useCallback(() => {
    setQuickCreateOpen(false);
    setSelectedLesson(null);
    setSlotDate(quickCreateStart);
    setSlotEndDate(quickCreateEnd || new Date(quickCreateStart.getTime() + 60 * 60 * 1000));
    setIsModalOpen(true);
  }, [quickCreateStart, quickCreateEnd]);

  const handleEditFromDetail = () => {
    setSelectedLesson(detailLesson);
    setSlotDate(undefined);
    setSlotEndDate(undefined);
    setDetailPanelOpen(false);
    setIsModalOpen(true);
  };

  const handleEditFromSidePanel = useCallback((lesson: LessonWithDetails) => {
    setSidePanelOpen(false);
    setSelectedLesson(lesson);
    setSlotDate(undefined);
    setSlotEndDate(undefined);
    setIsModalOpen(true);
  }, []);

  const handleSidePanelAttendance = useCallback((lesson: LessonWithDetails, status: string) => {
    // For "cancel" action, open the existing detail panel which has full cancel/attendance logic
    setSidePanelOpen(false);
    setDetailLesson(lesson);
    setDetailPanelOpen(true);
  }, []);

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedLesson(null);
    setSlotDate(undefined);
    setSlotEndDate(undefined);
  };

  const handleSaved = () => {
    refetch();
    setDetailPanelOpen(false);
  };

  // ─── Drag-to-reschedule handler ────────────────────────────
  const executeLessonMove = useCallback(
    async (lesson: LessonWithDetails, newStart: Date, newEnd: Date, mode: RecurringActionMode | 'single') => {
      // Snapshot original times for rollback
      const originalStartAt = lesson.start_at;
      const originalEndAt = lesson.end_at;

      // Optimistic update — immediately move the lesson in local state
      const affectedIds = new Set<string>();
      if (mode === 'this_and_future' && lesson.recurrence_id) {
        // Pre-compute affected IDs from current lessons
        const currentLessons = lessons;
        currentLessons.forEach(l => {
          if (l.recurrence_id === lesson.recurrence_id && l.start_at >= lesson.start_at) {
            affectedIds.add(l.id);
          }
        });
        // Update all future lessons in the series optimistically
        const offset = newStart.getTime() - new Date(originalStartAt).getTime();
        const newDuration = newEnd.getTime() - newStart.getTime();
        setLessons(prev => prev.map(l => {
          if (affectedIds.has(l.id)) {
            const shiftedStart = new Date(new Date(l.start_at).getTime() + offset);
            const shiftedEnd = new Date(shiftedStart.getTime() + newDuration);
            return { ...l, start_at: shiftedStart.toISOString(), end_at: shiftedEnd.toISOString() };
          }
          return l;
        }));
      } else {
        affectedIds.add(lesson.id);
        setLessons(prev => prev.map(l =>
          l.id === lesson.id
            ? { ...l, start_at: newStart.toISOString(), end_at: newEnd.toISOString() }
            : l
        ));
      }

      // Mark as saving (pulsing animation)
      setSavingLessonIds(prev => new Set([...prev, ...affectedIds]));

      try {
        if (mode === 'this_and_future' && lesson.recurrence_id) {
          const { error } = await supabase
            .from('lessons')
            .update({
              start_at: newStart.toISOString(),
              end_at: newEnd.toISOString(),
            })
            .eq('recurrence_id', lesson.recurrence_id)
            .gte('start_at', originalStartAt);

          if (error) throw error;
        } else {
          const updatePayload: Record<string, unknown> = {
            start_at: newStart.toISOString(),
            end_at: newEnd.toISOString(),
          };
          if (lesson.recurrence_id && mode === 'this_only') {
            updatePayload.is_series_exception = true;
          }
          const { error } = await supabase
            .from('lessons')
            .update(updatePayload)
            .eq('id', lesson.id);

          if (error) throw error;
        }

        // Fire-and-forget audit log for reschedule
        if (currentOrg && user) {
          logAudit(currentOrg.id, user.id, 'reschedule', 'lesson', lesson.id, {
            before: { start_at: originalStartAt, end_at: originalEndAt },
            after: { start_at: newStart.toISOString(), end_at: newEnd.toISOString() },
          });
        }

        toast({
          title: 'Lesson rescheduled',
          description: `Moved to ${format(newStart, 'EEE d MMM, HH:mm')}`,
        });
        refetch();
      } catch (err) {
        logger.error('Failed to reschedule lesson:', err);
        // Revert optimistic update
        setLessons(prev => prev.map(l => {
          if (l.id === lesson.id) {
            return { ...l, start_at: originalStartAt, end_at: originalEndAt };
          }
          return l;
        }));
        refetch(); // Full refetch to restore canonical state
        toast({
          title: 'Failed to reschedule',
          description: 'An error occurred. The lesson has been restored to its original time.',
          variant: 'destructive',
        });
      } finally {
        setSavingLessonIds(prev => {
          const next = new Set(prev);
          affectedIds.forEach(id => next.delete(id));
          return next;
        });
      }
    },
    [refetch, setLessons, lessons]
  );

  const handleLessonDrop = useCallback(
    async (lesson: LessonWithDetails, newStart: Date, newEnd: Date) => {
      // Run conflict detection
      const studentIds = (lesson.participants || []).map((p) => p.student.id);
      const conflicts = await checkConflicts({
        start_at: newStart,
        end_at: newEnd,
        teacher_user_id: lesson.teacher_user_id,
        room_id: lesson.room_id,
        location_id: lesson.location_id,
        student_ids: studentIds,
        exclude_lesson_id: lesson.id,
      });

      const blockers = conflicts.filter((c) => c.severity === 'error');
      if (blockers.length > 0) {
        toast({
          title: 'Cannot reschedule — conflict detected',
          description: blockers.map((c) => c.message).join('. '),
          variant: 'destructive',
        });
        return;
      }

      // Warn about non-blocking conflicts
      if (conflicts.length > 0) {
        toast({
          title: 'Rescheduled with warnings',
          description: conflicts.map((c) => c.message).join('. '),
        });
      }

      // If recurring, show dialog
      if (lesson.recurrence_id) {
        setPendingDrag({ lesson, newStart, newEnd, type: 'move' });
        setRecurringDialogOpen(true);
        return;
      }

      // Non-recurring: save immediately
      await executeLessonMove(lesson, newStart, newEnd, 'single');
    },
    [checkConflicts, executeLessonMove]
  );

  // ─── Drag-to-resize handler ────────────────────────────────
  const handleLessonResize = useCallback(
    async (lesson: LessonWithDetails, newEnd: Date) => {
      const newStart = new Date(lesson.start_at);

      // Run conflict detection
      const studentIds = (lesson.participants || []).map((p) => p.student.id);
      const conflicts = await checkConflicts({
        start_at: newStart,
        end_at: newEnd,
        teacher_user_id: lesson.teacher_user_id,
        room_id: lesson.room_id,
        location_id: lesson.location_id,
        student_ids: studentIds,
        exclude_lesson_id: lesson.id,
      });

      const blockers = conflicts.filter((c) => c.severity === 'error');
      if (blockers.length > 0) {
        toast({
          title: 'Cannot resize — conflict detected',
          description: blockers.map((c) => c.message).join('. '),
          variant: 'destructive',
        });
        return;
      }

      // If recurring, show dialog
      if (lesson.recurrence_id) {
        setPendingDrag({ lesson, newStart, newEnd, type: 'resize' });
        setRecurringDialogOpen(true);
        return;
      }

      // Non-recurring: save immediately
      await executeLessonMove(lesson, newStart, newEnd, 'single');
    },
    [checkConflicts, executeLessonMove]
  );

  // ─── Recurring dialog handler ──────────────────────────────
  const handleRecurringSelect = useCallback(
    async (mode: RecurringActionMode) => {
      setRecurringDialogOpen(false);
      if (!pendingDrag) return;
      await executeLessonMove(pendingDrag.lesson, pendingDrag.newStart, pendingDrag.newEnd, mode);
      setPendingDrag(null);
    },
    [pendingDrag, executeLessonMove]
  );


  // ─── MOBILE RENDERING ───────────────────────────────────────
  if (isMobile) {
    return (
      <AppLayout>
        {/* Mobile sticky header */}
        <div className="space-y-2 mb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {format(currentDate, 'MMMM d')}
              </h1>
              <p className="text-xs text-muted-foreground">
                {format(currentDate, 'EEEE')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday} className="h-8 px-3 text-xs">
              Today
            </Button>
          </div>

          {/* Compact week strip */}
          <WeekContextStrip
            currentDate={currentDate}
            onDayClick={setCurrentDate}
            lessonsByDay={lessonsByDay}
            view="day"
          />

          {/* Teacher filter pills */}
          <div data-tour="calendar-filters">
            <CalendarFiltersBar
              filters={filters}
              onChange={setFilters}
              teachers={teachers}
              locations={locations}
              rooms={rooms}
              teachersWithColours={teachersWithColours}
              lessons={lessons}
              currentDate={currentDate}
            />
          </div>
        </div>

        {/* Lesson list */}
        <SectionErrorBoundary name="Calendar">
          {isLoading ? (
            <CalendarSkeleton />
          ) : (
            <MobileDayView
              currentDate={currentDate}
              lessons={lessons}
              teacherColourMap={teacherColourMap}
              onLessonClick={handleLessonClick}
              savingLessonIds={savingLessonIds}
            />
          )}
        </SectionErrorBoundary>

        {/* FAB */}
        {!isParent && (
          <button
            onClick={() => {
              setSelectedLesson(null);
              const d = new Date(currentDate);
              d.setHours(9, 0, 0, 0);
              setSlotDate(d);
              setSlotEndDate(undefined);
              setIsModalOpen(true);
            }}
            className="fixed right-6 bottom-6 z-40 h-14 w-14 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            aria-label="New Lesson"
            disabled={!isOnline}
          >
            <Plus className="h-6 w-6" />
          </button>
        )}

        {/* Mobile bottom sheet */}
        <MobileLessonSheet
          lesson={mobileSheetLesson}
          open={mobileSheetOpen}
          onClose={() => setMobileSheetOpen(false)}
          onEdit={(lesson) => {
            setMobileSheetOpen(false);
            setSelectedLesson(lesson);
            setSlotDate(undefined);
            setSlotEndDate(undefined);
            setIsModalOpen(true);
          }}
          onOpenDetail={(lesson) => {
            setMobileSheetOpen(false);
            setDetailLesson(lesson);
            setDetailPanelOpen(true);
          }}
          teacherColour={getTeacherColour(teacherColourMap, mobileSheetLesson?.teacher_user_id
            ? teachers.find(t => t.userId === mobileSheetLesson.teacher_user_id)?.id ?? null
            : null)}
        />

        {/* Lesson Modal */}
        <LessonModal
          open={isModalOpen}
          onClose={handleModalClose}
          onSaved={handleSaved}
          lesson={selectedLesson}
          initialDate={slotDate}
          initialEndDate={slotEndDate}
        />

        {/* Lesson Detail Panel (for attendance/cancel actions) */}
        <LessonDetailPanel
          lesson={detailLesson}
          open={detailPanelOpen}
          onClose={() => setDetailPanelOpen(false)}
          onEdit={handleEditFromDetail}
          onUpdated={refetch}
        />

        <RecurringActionDialog
          open={recurringDialogOpen}
          onClose={() => { setRecurringDialogOpen(false); setPendingDrag(null); }}
          onSelect={handleRecurringSelect}
          action="edit"
        />
      </AppLayout>
    );
  }

  // ─── DESKTOP RENDERING ────────────────────────────────────
  return (
    <AppLayout>
      <PageHeader
        title={isParent ? 'Schedule' : 'Calendar'}
        description={isParent ? 'View upcoming lessons' : 'Manage your teaching schedule'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: isParent ? 'Schedule' : 'Calendar' },
        ]}
        actions={
          !isParent && (
            <Button onClick={() => { setSelectedLesson(null); setSlotDate(undefined); setIsModalOpen(true); }} className="gap-2" data-tour="create-lesson-button" disabled={!isOnline}>
              <Plus className="h-4 w-4" />
              New Lesson <span className="ml-1 text-[10px] opacity-60 bg-primary-foreground/20 px-1 rounded">N</span>
            </Button>
          )
        }
      />

      {/* Toolbar */}
      <div className="mb-3 space-y-2">
        {/* Row 1: Navigation + week strip + view toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" onClick={goToToday} className="shrink-0 h-8 px-2.5 text-xs sm:text-sm sm:px-3">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={navigateNext} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isParent && (
              <MarkDayCompleteButton
                currentDate={currentDate}
                lessons={lessons}
                onComplete={refetch}
              />
            )}
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as CalendarView)} data-tour="calendar-view-toggle">
              <ToggleGroupItem value="day" aria-label="Day view" className="h-8 w-8 p-0">
                <Calendar className="h-3.5 w-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="stacked" aria-label="Stacked view" className="h-8 w-8 p-0">
                <Columns3 className="h-3.5 w-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="Time grid view" className="h-8 w-8 p-0">
                <LayoutGrid className="h-3.5 w-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="agenda" aria-label="Agenda view" className="h-8 w-8 p-0">
                <List className="h-3.5 w-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="h-4 w-px bg-border mx-0.5" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={isCompact}
                  onPressedChange={setIsCompact}
                  aria-label="Compact mode"
                  className="h-8 w-8 p-0"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>Compact mode</TooltipContent>
            </Tooltip>

            {view === 'agenda' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    size="sm"
                    pressed={groupByTeacher}
                    onPressedChange={setGroupByTeacher}
                    aria-label="Group by teacher"
                    className="h-8 w-8 p-0"
                  >
                    <Users className="h-3.5 w-3.5" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>Group by teacher</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Week context strip */}
        <WeekContextStrip
          currentDate={currentDate}
          onDayClick={setCurrentDate}
          lessonsByDay={lessonsByDay}
          view={view}
        />

        {/* Row 2: Filters */}
        <div data-tour="calendar-filters">
          <CalendarFiltersBar
            filters={filters}
            onChange={setFilters}
            teachers={teachers}
            locations={locations}
            rooms={rooms}
            teachersWithColours={teachersWithColours}
            lessons={lessons}
            currentDate={currentDate}
          />
        </div>
      </div>

      {/* 500-lesson cap warning */}
      {isCapReached && (
        <Alert variant="default" className="mb-3 border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm">
            Showing first 500 lessons. Apply filters (teacher, location) to narrow results.
          </AlertDescription>
        </Alert>
      )}

      {/* Calendar content + side panel */}
      <div className="flex gap-0 min-h-0">
        <div className="flex-1 min-w-0">
          <SectionErrorBoundary name="Calendar">
            {isLoading ? (
              <CalendarSkeleton />
            ) : lessons.length === 0 && !isLoading ? (
              <EmptyState
                icon={Calendar}
                title="Your day is free"
                description="No lessons scheduled. Create your first lesson to get started!"
                actionLabel={!isParent ? "Create Lesson" : undefined}
                onAction={() => {
                  setSelectedLesson(null);
                  setSlotDate(undefined);
                  setIsModalOpen(true);
                }}
              />
            ) : view === 'agenda' ? (
              <AgendaView
                currentDate={currentDate}
                lessons={lessons}
                onLessonClick={handleLessonClick}
                teacherColourMap={teacherColourMap}
                groupByTeacher={groupByTeacher}
              />
            ) : view === 'day' ? (
              <DayTimelineView
                currentDate={currentDate}
                lessons={lessons}
                teacherColourMap={teacherColourMap}
                onLessonClick={handleLessonClick}
                onSlotClick={handleSlotClick}
                onSlotDrag={handleSlotDrag}
                onLessonDrop={!isParent ? handleLessonDrop : undefined}
                onLessonResize={!isParent ? handleLessonResize : undefined}
                isParent={isParent}
                savingLessonIds={savingLessonIds}
              />
            ) : view === 'stacked' ? (
              <StackedWeekView
                currentDate={currentDate}
                lessons={lessons}
                teacherColourMap={teacherColourMap}
                onLessonClick={handleLessonClick}
                onDayClick={(date) => {
                  if (isParent) return;
                  setQuickCreateStart(date);
                  setQuickCreateEnd(undefined);
                  setQuickCreateOpen(true);
                }}
                isParent={isParent}
                compact={isCompact}
              />
            ) : (
              <div data-tour="calendar-grid" data-hint="calendar-grid">
                <WeekTimeGrid
                  currentDate={currentDate}
                  lessons={lessons}
                  teacherColourMap={teacherColourMap}
                  onLessonClick={handleLessonClick}
                  onSlotClick={handleSlotClick}
                  onSlotDrag={handleSlotDrag}
                  onLessonDrop={!isParent ? handleLessonDrop : undefined}
                  onLessonResize={!isParent ? handleLessonResize : undefined}
                  isParent={isParent}
                  savingLessonIds={savingLessonIds}
                />
                {!isParent && (
                  <ContextualHint
                    id="calendar-create-lesson"
                    message="Click any time slot to create a lesson, or drag to set the duration. Grab a lesson card to reschedule it."
                    position="top"
                    targetSelector="[data-hint='calendar-grid']"
                  />
                )}
              </div>
            )}
          </SectionErrorBoundary>
        </div>

        {/* Desktop side panel */}
        {isDesktop && (
          <LessonDetailSidePanel
            lesson={sidePanelLesson}
            open={sidePanelOpen}
            onClose={() => setSidePanelOpen(false)}
            onEdit={handleEditFromSidePanel}
            onMarkAttendance={handleSidePanelAttendance}
            teacherColour={getTeacherColour(teacherColourMap, sidePanelLesson?.teacher_user_id ? 
              teachers.find(t => t.userId === sidePanelLesson.teacher_user_id)?.id ?? null
              : null)}
          />
        )}
      </div>

      {/* Keyboard shortcuts hint — desktop only */}
      <div className="mt-3 text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
        <span className="font-medium">Keyboard:</span> ← → navigate • T today • N new lesson • S/W/A views
      </div>

      {/* Quick Create Popover */}
      {!isParent && (
        <QuickCreatePopover
          open={quickCreateOpen}
          onClose={() => setQuickCreateOpen(false)}
          onSaved={handleSaved}
          onOpenFullModal={handleQuickCreateOpenFullModal}
          startDate={quickCreateStart}
          endDate={quickCreateEnd}
        />
      )}

      {/* Lesson Modal */}
      <LessonModal
        open={isModalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        lesson={selectedLesson}
        initialDate={slotDate}
        initialEndDate={slotEndDate}
      />

      {/* Lesson Detail Panel */}
      <LessonDetailPanel
        lesson={detailLesson}
        open={detailPanelOpen}
        onClose={() => setDetailPanelOpen(false)}
        onEdit={handleEditFromDetail}
        onUpdated={refetch}
      />

      {/* Recurring Action Dialog for drag operations */}
      <RecurringActionDialog
        open={recurringDialogOpen}
        onClose={() => {
          setRecurringDialogOpen(false);
          setPendingDrag(null);
        }}
        onSelect={handleRecurringSelect}
        action="edit"
      />
    </AppLayout>
  );
}
