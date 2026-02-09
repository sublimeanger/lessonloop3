import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, addWeeks, subWeeks, startOfWeek, addDays } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/contexts/OrgContext';
import { useCalendarData, useTeachersAndLocations } from '@/hooks/useCalendarData';
import { WeekTimeGrid } from '@/components/calendar/WeekTimeGrid';
import { AgendaView } from '@/components/calendar/AgendaView';
import { LessonModal } from '@/components/calendar/LessonModal';
import { LessonDetailPanel } from '@/components/calendar/LessonDetailPanel';
import { CalendarFiltersBar } from '@/components/calendar/CalendarFiltersBar';
import { MarkDayCompleteButton } from '@/components/calendar/MarkDayCompleteButton';
import { RecurringActionDialog, RecurringActionMode } from '@/components/calendar/RecurringActionDialog';
import { CalendarView, CalendarFilters, LessonWithDetails } from '@/components/calendar/types';
import { buildTeacherColourMap } from '@/components/calendar/teacherColours';
import { ContextualHint } from '@/components/shared/ContextualHint';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Plus, List, LayoutGrid, Loader2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function CalendarPage() {
  const { currentRole } = useOrg();
  const isParent = currentRole === 'parent';
  const { teachers, locations, rooms } = useTeachersAndLocations();
  const [searchParams] = useSearchParams();
  const { checkConflicts } = useConflictDetection();

  // Calendar state
  const [currentDate, setCurrentDate] = useState(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? new Date(dateParam) : new Date();
  });
  const [view, setView] = useState<CalendarView>('week');
  const [filters, setFilters] = useState<CalendarFilters>(() => ({
    teacher_id: searchParams.get('teacher') || null,
    location_id: null,
    room_id: null,
  }));

  // Lesson modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonWithDetails | null>(null);
  const [slotDate, setSlotDate] = useState<Date | undefined>(undefined);
  const [slotEndDate, setSlotEndDate] = useState<Date | undefined>(undefined);

  // Detail panel state
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [detailLesson, setDetailLesson] = useState<LessonWithDetails | null>(null);

  // Drag reschedule / resize state for recurring dialog
  const [pendingDrag, setPendingDrag] = useState<{
    lesson: LessonWithDetails;
    newStart: Date;
    newEnd: Date;
    type: 'move' | 'resize';
  } | null>(null);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);

  // Fetch lessons
  const { lessons, isLoading, refetch } = useCalendarData(currentDate, view, filters);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowLeft': navigatePrev(); break;
        case 'ArrowRight': navigateNext(); break;
        case 't': case 'T': goToToday(); break;
        case 'n': case 'N':
          if (!isParent) {
            setSelectedLesson(null);
            setSlotDate(undefined);
            setSlotEndDate(undefined);
            setIsModalOpen(true);
          }
          break;
        case 'w': setView('week'); break;
        case 'a': setView('agenda'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate, view, isParent]);

  // ─── Core handlers ─────────────────────────────────────────
  const handleLessonClick = useCallback((lesson: LessonWithDetails) => {
    setDetailLesson(lesson);
    setDetailPanelOpen(true);
  }, []);

  const handleSlotClick = useCallback((date: Date) => {
    if (isParent) return;
    setSelectedLesson(null);
    setSlotDate(date);
    setSlotEndDate(new Date(date.getTime() + 60 * 60 * 1000));
    setIsModalOpen(true);
  }, [isParent]);

  const handleSlotDrag = useCallback((start: Date, end: Date) => {
    if (isParent) return;
    setSelectedLesson(null);
    setSlotDate(start);
    setSlotEndDate(end);
    setIsModalOpen(true);
  }, [isParent]);

  const handleEditFromDetail = () => {
    setSelectedLesson(detailLesson);
    setSlotDate(undefined);
    setSlotEndDate(undefined);
    setDetailPanelOpen(false);
    setIsModalOpen(true);
  };

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
      try {
        if (mode === 'this_and_future' && lesson.recurrence_id) {
          // Update this and all future lessons in the series
          const { error } = await supabase
            .from('lessons')
            .update({
              start_at: newStart.toISOString(),
              end_at: newEnd.toISOString(),
            })
            .eq('recurrence_id', lesson.recurrence_id)
            .gte('start_at', lesson.start_at);

          if (error) throw error;
        } else {
          // Update just this lesson
          const { error } = await supabase
            .from('lessons')
            .update({
              start_at: newStart.toISOString(),
              end_at: newEnd.toISOString(),
            })
            .eq('id', lesson.id);

          if (error) throw error;
        }

        toast({
          title: 'Lesson rescheduled',
          description: `Moved to ${format(newStart, 'EEE d MMM, HH:mm')}`,
        });
        refetch();
      } catch (err) {
        console.error('Failed to reschedule lesson:', err);
        toast({
          title: 'Failed to reschedule',
          description: 'An error occurred. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [refetch]
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

  // Date display — always week range
  const getDateDisplay = () => {
    if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, 'd')} – ${format(weekEnd, 'd MMMM yyyy')}`;
      }
      return `${format(weekStart, 'd MMM')} – ${format(weekEnd, 'd MMM yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  };

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
            <Button onClick={() => { setSelectedLesson(null); setSlotDate(undefined); setIsModalOpen(true); }} className="gap-2" data-tour="create-lesson-button">
              <Plus className="h-4 w-4" />
              New Lesson
            </Button>
          )
        }
      />

      {/* Toolbar */}
      <div className="mb-3 space-y-2">
        {/* Row 1: Navigation + view toggle */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <Button variant="outline" size="sm" onClick={goToToday} className="shrink-0 h-8 px-2.5 text-xs sm:text-sm sm:px-3">
              Today
            </Button>
            <div className="flex items-center shrink-0">
              <Button variant="ghost" size="icon" onClick={navigatePrev} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={navigateNext} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <span className="font-medium truncate text-xs sm:text-sm">{getDateDisplay()}</span>
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
              <ToggleGroupItem value="week" aria-label="Week view" className="h-8 w-8 p-0">
                <LayoutGrid className="h-3.5 w-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="agenda" aria-label="Agenda view" className="h-8 w-8 p-0">
                <List className="h-3.5 w-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Row 2: Filters */}
        <div data-tour="calendar-filters">
          <CalendarFiltersBar
            filters={filters}
            onChange={setFilters}
            teachers={teachers}
            locations={locations}
            rooms={rooms}
            teachersWithColours={teachersWithColours}
          />
        </div>
      </div>

      {/* Calendar content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'agenda' ? (
        <AgendaView
          currentDate={currentDate}
          lessons={lessons}
          onLessonClick={handleLessonClick}
          teacherColourMap={teacherColourMap}
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

      {/* Keyboard shortcuts hint — desktop only */}
      <div className="mt-3 text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
        <span className="font-medium">Keyboard:</span> ← → navigate • T today • N new lesson • W/A views
      </div>

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
