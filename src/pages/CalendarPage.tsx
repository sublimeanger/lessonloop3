import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, addDays, subDays, addWeeks, subWeeks, startOfWeek } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/contexts/OrgContext';
import { useCalendarData, useTeachersAndLocations } from '@/hooks/useCalendarData';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { StackedWeekView } from '@/components/calendar/StackedWeekView';
import { AgendaView } from '@/components/calendar/AgendaView';
import { LessonModal } from '@/components/calendar/LessonModal';
import { LessonDetailPanel } from '@/components/calendar/LessonDetailPanel';
import { CalendarFiltersBar } from '@/components/calendar/CalendarFiltersBar';

import { MarkDayCompleteButton } from '@/components/calendar/MarkDayCompleteButton';
import { CalendarView, CalendarFilters, LessonWithDetails } from '@/components/calendar/types';
import { buildTeacherColourMap } from '@/components/calendar/teacherColours';
import { ContextualHint } from '@/components/shared/ContextualHint';
import { Calendar, ChevronLeft, ChevronRight, Plus, List, CalendarDays, LayoutGrid, Loader2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function CalendarPage() {
  const { currentRole } = useOrg();
  const isParent = currentRole === 'parent';
  const { teachers, locations, rooms } = useTeachersAndLocations();
  const [searchParams] = useSearchParams();

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

  // Fetch lessons
  const { lessons, isLoading, refetch } = useCalendarData(currentDate, view, filters);

  // Teacher colour map
  const teacherColourMap = useMemo(() => buildTeacherColourMap(teachers), [teachers]);
  const teachersWithColours = useMemo(
    () => Array.from(teacherColourMap.values()),
    [teacherColourMap]
  );

  // Navigation
  const navigatePrev = () => {
    if (view === 'day') {
      setCurrentDate(subDays(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (view === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          navigatePrev();
          break;
        case 'ArrowRight':
          navigateNext();
          break;
        case 't':
        case 'T':
          goToToday();
          break;
        case 'n':
        case 'N':
          if (!isParent) {
            setSelectedLesson(null);
            setSlotDate(undefined);
            setSlotEndDate(undefined);
            setIsModalOpen(true);
          }
          break;
        case 'd':
          setView('day');
          break;
        case 'w':
          setView('week');
          break;
        case 'a':
          setView('agenda');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate, view, isParent]);

  // Handlers
  const handleLessonClick = useCallback((lesson: LessonWithDetails) => {
    setDetailLesson(lesson);
    setDetailPanelOpen(true);
  }, []);

  const handleSlotClick = useCallback((date: Date) => {
    if (isParent) return;
    setSelectedLesson(null);
    setSlotDate(date);
    setSlotEndDate(new Date(date.getTime() + 60 * 60 * 1000)); // Default 1 hour
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

  // Date display
  const getDateDisplay = () => {
    if (view === 'day') {
      return format(currentDate, 'EEEE, d MMMM yyyy');
    } else if (view === 'week') {
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
              <ToggleGroupItem value="day" aria-label="Day view" className="h-8 w-8 p-0">
                <CalendarDays className="h-3.5 w-3.5" />
              </ToggleGroupItem>
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
      ) : view === 'week' ? (
        <div data-tour="calendar-grid" data-hint="calendar-grid">
          <StackedWeekView
            currentDate={currentDate}
            lessons={lessons}
            teacherColourMap={teacherColourMap}
            onLessonClick={handleLessonClick}
            onSlotClick={handleSlotClick}
            isParent={isParent}
          />
        </div>
      ) : (
        <div data-tour="calendar-grid" data-hint="calendar-grid">
          <CalendarGrid
            currentDate={currentDate}
            view={view}
            lessons={lessons}
            onLessonClick={handleLessonClick}
            onSlotClick={handleSlotClick}
            onSlotDrag={handleSlotDrag}
            teacherColourMap={teacherColourMap}
          />
          {!isParent && (
            <ContextualHint
              id="calendar-create-lesson"
              message="Click any time slot to create a lesson, or drag to set the duration"
              position="top"
              targetSelector="[data-hint='calendar-grid']"
            />
          )}
        </div>
      )}

      {/* Keyboard shortcuts hint — desktop only */}
      <div className="mt-3 text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
        <span className="font-medium">Keyboard:</span> ← → navigate • T today • N new lesson • D/W/A views
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
    </AppLayout>
  );
}
