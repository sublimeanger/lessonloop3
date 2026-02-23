import { useCallback } from 'react';
import { format, addWeeks, subWeeks } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MobileDayView } from './MobileDayView';
import { MobileLessonSheet } from './MobileLessonSheet';
import { WeekContextStrip } from './WeekContextStrip';
import { CalendarFiltersBar } from './CalendarFiltersBar';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { CalendarSkeleton } from '@/components/shared/LoadingState';
import { getTeacherColour, TeacherWithColour } from './teacherColours';
import { Plus, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import type { CalendarFilters, LessonWithDetails } from './types';
import type { useCalendarActions } from '@/hooks/useCalendarActions';

interface TeacherInfo {
  id: string;
  userId: string | null;
  name: string;
}

interface CalendarMobileLayoutProps {
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  goToToday: () => void;
  lessons: LessonWithDetails[];
  lessonsByDay: Map<string, LessonWithDetails[]>;
  isLoading: boolean;
  isCapReached?: boolean;
  isParent: boolean;
  isOnline: boolean;
  filters: CalendarFilters;
  setFilters: (f: CalendarFilters) => void;
  teachers: TeacherInfo[];
  locations: { id: string; name: string }[];
  rooms: { id: string; name: string; location_id: string }[];
  instruments: string[];
  teachersWithColours: TeacherWithColour[];
  teacherColourMap: Map<string, TeacherWithColour>;
  actions: ReturnType<typeof useCalendarActions>;
}

export function CalendarMobileLayout({
  currentDate,
  setCurrentDate,
  goToToday,
  lessons,
  lessonsByDay,
  isLoading,
  isCapReached,
  isParent,
  isOnline,
  filters,
  setFilters,
  teachers,
  locations,
  rooms,
  instruments,
  teachersWithColours,
  teacherColourMap,
  actions,
}: CalendarMobileLayoutProps) {
  // hide_cancelled is now applied server-side in useCalendarData

  const navigatePrev = useCallback(() => setCurrentDate(subWeeks(currentDate, 1)), [currentDate, setCurrentDate]);
  const navigateNext = useCallback(() => setCurrentDate(addWeeks(currentDate, 1)), [currentDate, setCurrentDate]);

  return (
    <AppLayout>
      <div className="sticky top-0 z-20 bg-background pb-2 space-y-2">
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">{format(currentDate, 'MMMM d')}</h1>
            <p className="text-xs text-muted-foreground">{format(currentDate, 'EEEE')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={goToToday} className="h-8 px-3 text-xs">Today</Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={navigatePrev} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <WeekContextStrip currentDate={currentDate} onDayClick={setCurrentDate} lessonsByDay={lessonsByDay} view="day" />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={navigateNext} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div data-tour="calendar-filters">
          <CalendarFiltersBar filters={filters} onChange={setFilters} teachers={teachers} locations={locations} rooms={rooms} instruments={instruments} teachersWithColours={teachersWithColours} lessons={lessons} currentDate={currentDate} />
        </div>
      </div>

      {isCapReached && (
        <Alert variant="default" className="mb-2 border-warning/50 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs">Showing maximum lessons. Use filters to narrow results.</AlertDescription>
        </Alert>
      )}

      <SectionErrorBoundary name="Calendar">
        {isLoading ? <CalendarSkeleton /> : lessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-lg">No lessons today</p>
            {!isParent && <p className="text-sm mt-1">Tap + to create a lesson</p>}
          </div>
        ) : (
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
          className="fixed right-6 bottom-6 z-40 h-14 w-14 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
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
        teacherColour={getTeacherColour(teacherColourMap, actions.mobileSheetLesson?.teacher_id ?? null)}
      />
    </AppLayout>
  );
}
