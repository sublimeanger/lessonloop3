import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { useSearchParams } from 'react-router-dom';
import { format, addWeeks, subWeeks, parseISO } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendarData, useTeachersAndLocations } from '@/hooks/useCalendarData';
import { useCalendarActions } from '@/hooks/useCalendarActions';
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
import { RecurringActionDialog } from '@/components/calendar/RecurringActionDialog';
import { CalendarView, CalendarFilters, LessonWithDetails } from '@/components/calendar/types';
import { buildTeacherColourMap } from '@/components/calendar/teacherColours';
import { QuickCreatePopover } from '@/components/calendar/QuickCreatePopover';
import { ContextualHint } from '@/components/shared/ContextualHint';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Plus, List, LayoutGrid, Columns3, Minimize2, Users, AlertTriangle, Calendar } from 'lucide-react';
import { CalendarSkeleton } from '@/components/shared/LoadingState';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LoopAssistPageBanner } from '@/components/shared/LoopAssistPageBanner';
import { useProactiveAlerts } from '@/hooks/useProactiveAlerts';

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
  const isDesktop = useIsDesktop();

  // Calendar navigation state
  const [currentDate, setCurrentDate] = useState(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? new Date(dateParam) : new Date();
  });
  const [view, setView] = useState<CalendarView>('day');
  const [isCompact, setIsCompact] = useState(() => safeGetItem('ll-calendar-compact') === '1');
  const [groupByTeacher, setGroupByTeacher] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>(() => ({
    teacher_id: searchParams.get('teacher') || null,
    location_id: null,
    room_id: null,
  }));

  useEffect(() => { safeSetItem('ll-calendar-compact', isCompact ? '1' : '0'); }, [isCompact]);

  // Fetch lessons
  const { lessons, setLessons, isLoading, isCapReached, refetch } = useCalendarData(currentDate, view, filters);

  // Actions hook
  const actions = useCalendarActions({
    lessons, setLessons, refetch,
    currentOrg, user,
    checkConflicts, isOnline, isMobile, isDesktop, isParent,
  });

  // Lessons grouped by day
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
  const teachersWithColours = useMemo(() => Array.from(teacherColourMap.values()), [teacherColourMap]);

  // Navigation
  const navigatePrev = () => setCurrentDate(subWeeks(currentDate, 1));
  const navigateNext = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Keyboard navigation
  useEffect(() => {
    const handleCalendarToday = () => goToToday();
    const handleCalendarPrev = () => navigatePrev();
    const handleCalendarNext = () => navigateNext();
    const handleCalendarNewLesson = () => { if (!isParent) actions.openNewLessonModal(); };
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

  // Handle ?action=new query param
  useEffect(() => {
    if (searchParams.get('action') === 'new' && !isParent && !actions.isModalOpen) {
      actions.openNewLessonModal();
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      window.history.replaceState(null, '', `?${newParams.toString()}`);
    }
  }, [searchParams, isParent, actions.isModalOpen]);

  // ─── MOBILE RENDERING ───────────────────────────────────────
  if (isMobile) {
    return (
      <AppLayout>
        <div className="space-y-2 mb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">{format(currentDate, 'MMMM d')}</h1>
              <p className="text-xs text-muted-foreground">{format(currentDate, 'EEEE')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday} className="h-8 px-3 text-xs">Today</Button>
          </div>
          <WeekContextStrip currentDate={currentDate} onDayClick={setCurrentDate} lessonsByDay={lessonsByDay} view="day" />
          <div data-tour="calendar-filters">
            <CalendarFiltersBar filters={filters} onChange={setFilters} teachers={teachers} locations={locations} rooms={rooms} teachersWithColours={teachersWithColours} lessons={lessons} currentDate={currentDate} />
          </div>
        </div>

        <SectionErrorBoundary name="Calendar">
          {isLoading ? <CalendarSkeleton /> : (
            <MobileDayView currentDate={currentDate} lessons={lessons} teacherColourMap={teacherColourMap} onLessonClick={actions.handleLessonClick} savingLessonIds={actions.savingLessonIds} />
          )}
        </SectionErrorBoundary>

        {!isParent && (
          <button
            onClick={() => {
              const d = new Date(currentDate);
              d.setHours(9, 0, 0, 0);
              actions.openNewLessonModal(d);
            }}
            className="fixed right-6 bottom-6 z-40 h-14 w-14 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            aria-label="New Lesson"
            disabled={!isOnline}
          >
            <Plus className="h-6 w-6" />
          </button>
        )}

        <MobileLessonSheet
          lesson={actions.mobileSheetLesson}
          open={actions.mobileSheetOpen}
          onClose={() => actions.setMobileSheetOpen(false)}
          onEdit={actions.openEditFromMobileSheet}
          onOpenDetail={actions.openDetailFromMobileSheet}
          teacherColour={getTeacherColour(teacherColourMap, actions.mobileSheetLesson?.teacher_user_id
            ? teachers.find(t => t.userId === actions.mobileSheetLesson!.teacher_user_id)?.id ?? null
            : null)}
        />

        <LessonModal open={actions.isModalOpen} onClose={actions.handleModalClose} onSaved={actions.handleSaved} lesson={actions.selectedLesson} initialDate={actions.slotDate} initialEndDate={actions.slotEndDate} />
        <LessonDetailPanel lesson={actions.detailLesson} open={actions.detailPanelOpen} onClose={() => actions.setDetailPanelOpen(false)} onEdit={actions.handleEditFromDetail} onUpdated={refetch} />
        <RecurringActionDialog open={actions.recurringDialogOpen} onClose={actions.closeRecurringDialog} onSelect={actions.handleRecurringSelect} action="edit" />
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
            <Button onClick={() => actions.openNewLessonModal()} className="gap-2" data-tour="create-lesson-button" disabled={!isOnline}>
              <Plus className="h-4 w-4" />
              New Lesson <span className="ml-1 text-[10px] opacity-60 bg-primary-foreground/20 px-1 rounded">N</span>
            </Button>
          )
        }
      />

      <CalendarUnmarkedBanner />

      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" onClick={goToToday} className="shrink-0 h-8 px-2.5 text-xs sm:text-sm sm:px-3">Today</Button>
            <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={navigateNext} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isParent && <MarkDayCompleteButton currentDate={currentDate} lessons={lessons} onComplete={refetch} />}
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as CalendarView)} data-tour="calendar-view-toggle">
              <ToggleGroupItem value="day" aria-label="Day view" className="h-8 w-8 p-0"><Calendar className="h-3.5 w-3.5" /></ToggleGroupItem>
              <ToggleGroupItem value="stacked" aria-label="Stacked view" className="h-8 w-8 p-0"><Columns3 className="h-3.5 w-3.5" /></ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="Time grid view" className="h-8 w-8 p-0"><LayoutGrid className="h-3.5 w-3.5" /></ToggleGroupItem>
              <ToggleGroupItem value="agenda" aria-label="Agenda view" className="h-8 w-8 p-0"><List className="h-3.5 w-3.5" /></ToggleGroupItem>
            </ToggleGroup>

            <div className="h-4 w-px bg-border mx-0.5" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle size="sm" pressed={isCompact} onPressedChange={setIsCompact} aria-label="Compact mode" className="h-8 w-8 p-0">
                  <Minimize2 className="h-3.5 w-3.5" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>Compact mode</TooltipContent>
            </Tooltip>

            {view === 'agenda' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle size="sm" pressed={groupByTeacher} onPressedChange={setGroupByTeacher} aria-label="Group by teacher" className="h-8 w-8 p-0">
                    <Users className="h-3.5 w-3.5" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>Group by teacher</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <WeekContextStrip currentDate={currentDate} onDayClick={setCurrentDate} lessonsByDay={lessonsByDay} view={view} />

        <div data-tour="calendar-filters">
          <CalendarFiltersBar filters={filters} onChange={setFilters} teachers={teachers} locations={locations} rooms={rooms} teachersWithColours={teachersWithColours} lessons={lessons} currentDate={currentDate} />
        </div>
      </div>

      {isCapReached && (
        <Alert variant="default" className="mb-3 border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm">Showing first 500 lessons. Apply filters (teacher, location) to narrow results.</AlertDescription>
        </Alert>
      )}

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
                onAction={() => actions.openNewLessonModal()}
              />
            ) : view === 'agenda' ? (
              <AgendaView currentDate={currentDate} lessons={lessons} onLessonClick={actions.handleLessonClick} teacherColourMap={teacherColourMap} groupByTeacher={groupByTeacher} />
            ) : view === 'day' ? (
              <DayTimelineView
                currentDate={currentDate} lessons={lessons} teacherColourMap={teacherColourMap}
                onLessonClick={actions.handleLessonClick} onSlotClick={actions.handleSlotClick} onSlotDrag={actions.handleSlotDrag}
                onLessonDrop={!isParent ? actions.handleLessonDrop : undefined} onLessonResize={!isParent ? actions.handleLessonResize : undefined}
                isParent={isParent} savingLessonIds={actions.savingLessonIds}
              />
            ) : view === 'stacked' ? (
              <StackedWeekView
                currentDate={currentDate} lessons={lessons} teacherColourMap={teacherColourMap}
                onLessonClick={actions.handleLessonClick}
                onDayClick={(date) => { if (!isParent) { actions.handleSlotClick(date); } }}
                isParent={isParent} compact={isCompact}
              />
            ) : (
              <div data-tour="calendar-grid" data-hint="calendar-grid">
                <WeekTimeGrid
                  currentDate={currentDate} lessons={lessons} teacherColourMap={teacherColourMap}
                  onLessonClick={actions.handleLessonClick} onSlotClick={actions.handleSlotClick} onSlotDrag={actions.handleSlotDrag}
                  onLessonDrop={!isParent ? actions.handleLessonDrop : undefined} onLessonResize={!isParent ? actions.handleLessonResize : undefined}
                  isParent={isParent} savingLessonIds={actions.savingLessonIds}
                />
                {!isParent && (
                  <ContextualHint id="calendar-create-lesson" message="Click any time slot to create a lesson, or drag to set the duration. Grab a lesson card to reschedule it." position="top" targetSelector="[data-hint='calendar-grid']" />
                )}
              </div>
            )}
          </SectionErrorBoundary>
        </div>

        {isDesktop && (
          <LessonDetailSidePanel
            lesson={actions.sidePanelLesson} open={actions.sidePanelOpen} onClose={() => actions.setSidePanelOpen(false)}
            onEdit={actions.handleEditFromSidePanel} onMarkAttendance={actions.handleSidePanelAttendance}
            teacherColour={getTeacherColour(teacherColourMap, actions.sidePanelLesson?.teacher_user_id
              ? teachers.find(t => t.userId === actions.sidePanelLesson!.teacher_user_id)?.id ?? null
              : null)}
          />
        )}
      </div>

      <div className="mt-3 text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
        <span className="font-medium">Keyboard:</span> ← → navigate • T today • N new lesson • S/W/A views
      </div>

      {!isParent && (
        <QuickCreatePopover open={actions.quickCreateOpen} onClose={() => actions.setQuickCreateOpen(false)} onSaved={actions.handleSaved} onOpenFullModal={actions.handleQuickCreateOpenFullModal} startDate={actions.quickCreateStart} endDate={actions.quickCreateEnd} />
      )}

      <LessonModal open={actions.isModalOpen} onClose={actions.handleModalClose} onSaved={actions.handleSaved} lesson={actions.selectedLesson} initialDate={actions.slotDate} initialEndDate={actions.slotEndDate} />
      <LessonDetailPanel lesson={actions.detailLesson} open={actions.detailPanelOpen} onClose={() => actions.setDetailPanelOpen(false)} onEdit={actions.handleEditFromDetail} onUpdated={refetch} />
      <RecurringActionDialog open={actions.recurringDialogOpen} onClose={actions.closeRecurringDialog} onSelect={actions.handleRecurringSelect} action="edit" />
    </AppLayout>
  );
}

function CalendarUnmarkedBanner() {
  const { alerts } = useProactiveAlerts();
  const unmarked = alerts.find(a => a.type === 'unmarked');
  if (!unmarked || !unmarked.count) return null;

  return (
    <LoopAssistPageBanner
      bannerKey="calendar_unmarked"
      message={`${unmarked.count} lesson${unmarked.count > 1 ? 's' : ''} from recently need marking — Let LoopAssist handle it`}
      prompt="Mark all yesterday's lessons as complete"
    />
  );
}
