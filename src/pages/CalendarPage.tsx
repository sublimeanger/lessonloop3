import { useState, useCallback, useEffect } from 'react';
import { format, addDays, subDays, addWeeks, subWeeks, startOfWeek } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useOrg } from '@/contexts/OrgContext';
import { useCalendarData, useTeachersAndLocations } from '@/hooks/useCalendarData';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { AgendaView } from '@/components/calendar/AgendaView';
import { LessonModal } from '@/components/calendar/LessonModal';
import { LessonDetailPanel } from '@/components/calendar/LessonDetailPanel';
import { CalendarFiltersBar } from '@/components/calendar/CalendarFiltersBar';
import { MarkDayCompleteButton } from '@/components/calendar/MarkDayCompleteButton';
import { CalendarView, CalendarFilters, LessonWithDetails } from '@/components/calendar/types';
import { ContextualHint } from '@/components/shared/ContextualHint';
import { Calendar, ChevronLeft, ChevronRight, Plus, List, CalendarDays, LayoutGrid, Loader2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function CalendarPage() {
  const { currentRole } = useOrg();
  const isParent = currentRole === 'parent';
  const { teachers, locations, rooms } = useTeachersAndLocations();

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('week');
  const [filters, setFilters] = useState<CalendarFilters>({
    teacher_id: null,
    location_id: null,
    room_id: null,
  });

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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="font-medium min-w-[200px]">{getDateDisplay()}</span>
          
          {!isParent && (
            <MarkDayCompleteButton
              currentDate={currentDate}
              lessons={lessons}
              onComplete={refetch}
            />
          )}
        </div>

        <div className="flex items-center gap-4">
          <div data-tour="calendar-filters">
            <CalendarFiltersBar
              filters={filters}
              onChange={setFilters}
              teachers={teachers}
              locations={locations}
              rooms={rooms}
            />
          </div>
          
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as CalendarView)} data-tour="calendar-view-toggle">
            <ToggleGroupItem value="day" aria-label="Day view">
              <CalendarDays className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="week" aria-label="Week view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="agenda" aria-label="Agenda view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
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
        />
      ) : (
        <div data-tour="calendar-grid" data-hint="calendar-grid">
          <CalendarGrid
            currentDate={currentDate}
            view={view}
            lessons={lessons}
            onLessonClick={handleLessonClick}
            onSlotClick={handleSlotClick}
            onSlotDrag={handleSlotDrag}
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

      {/* Keyboard shortcuts hint */}
      <div className="mt-4 text-xs text-muted-foreground">
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
