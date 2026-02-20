import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { WeekTimeGrid } from './WeekTimeGrid';
import { AgendaView } from './AgendaView';
import { StackedWeekView } from './StackedWeekView';
import { DayTimelineView } from './DayTimelineView';
import { WeekContextStrip } from './WeekContextStrip';
import { CalendarFiltersBar } from './CalendarFiltersBar';
import { MarkDayCompleteButton } from './MarkDayCompleteButton';
import { LessonDetailSidePanel } from './LessonDetailSidePanel';
import { getTeacherColour, TeacherWithColour } from './teacherColours';
import { ContextualHint } from '@/components/shared/ContextualHint';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { CalendarSkeleton } from '@/components/shared/LoadingState';
import { LoopAssistPageBanner } from '@/components/shared/LoopAssistPageBanner';
import { useProactiveAlerts } from '@/hooks/useProactiveAlerts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Plus, List, LayoutGrid, Columns3, Minimize2, Users, AlertTriangle, Calendar } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QuickCreatePopover } from './QuickCreatePopover';
import type { CalendarView, CalendarFilters, LessonWithDetails } from './types';
import type { useCalendarActions } from '@/hooks/useCalendarActions';

interface TeacherInfo {
  id: string;
  userId: string | null;
  name: string;
}

interface CalendarDesktopLayoutProps {
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  view: CalendarView;
  setView: (v: CalendarView) => void;
  isCompact: boolean;
  setIsCompact: (v: boolean) => void;
  groupByTeacher: boolean;
  setGroupByTeacher: (v: boolean) => void;
  goToToday: () => void;
  navigatePrev: () => void;
  navigateNext: () => void;
  lessons: LessonWithDetails[];
  lessonsByDay: Map<string, LessonWithDetails[]>;
  isLoading: boolean;
  isCapReached: boolean;
  isParent: boolean;
  isDesktop: boolean;
  isOnline: boolean;
  filters: CalendarFilters;
  setFilters: (f: CalendarFilters) => void;
  teachers: TeacherInfo[];
  locations: { id: string; name: string }[];
  rooms: { id: string; name: string; location_id: string }[];
  teachersWithColours: TeacherWithColour[];
  teacherColourMap: Map<string, TeacherWithColour>;
  actions: ReturnType<typeof useCalendarActions>;
  refetch: () => void;
}

export function CalendarDesktopLayout({
  currentDate,
  setCurrentDate,
  view,
  setView,
  isCompact,
  setIsCompact,
  groupByTeacher,
  setGroupByTeacher,
  goToToday,
  navigatePrev,
  navigateNext,
  lessons,
  lessonsByDay,
  isLoading,
  isCapReached,
  isParent,
  isDesktop,
  isOnline,
  filters,
  setFilters,
  teachers,
  locations,
  rooms,
  teachersWithColours,
  teacherColourMap,
  actions,
  refetch,
}: CalendarDesktopLayoutProps) {
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
