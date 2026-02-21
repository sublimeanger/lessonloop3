import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { MobileDayView } from './MobileDayView';
import { MobileLessonSheet } from './MobileLessonSheet';
import { WeekContextStrip } from './WeekContextStrip';
import { CalendarFiltersBar } from './CalendarFiltersBar';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { CalendarSkeleton } from '@/components/shared/LoadingState';
import { getTeacherColour, TeacherWithColour } from './teacherColours';
import { Plus } from 'lucide-react';
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
  isParent: boolean;
  isOnline: boolean;
  filters: CalendarFilters;
  setFilters: (f: CalendarFilters) => void;
  teachers: TeacherInfo[];
  locations: { id: string; name: string }[];
  rooms: { id: string; name: string; location_id: string }[];
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
  isParent,
  isOnline,
  filters,
  setFilters,
  teachers,
  locations,
  rooms,
  teachersWithColours,
  teacherColourMap,
  actions,
}: CalendarMobileLayoutProps) {
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
        teacherColour={getTeacherColour(teacherColourMap, actions.mobileSheetLesson?.teacher_id ?? null)}
      />
    </AppLayout>
  );
}
