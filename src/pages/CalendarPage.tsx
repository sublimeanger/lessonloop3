import { useState, useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { useSearchParams } from 'react-router-dom';
import { format, addWeeks, subWeeks, addDays, subDays, parseISO } from 'date-fns';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendarData, useTeachersAndLocations } from '@/hooks/useCalendarData';
import { useCalendarActions } from '@/hooks/useCalendarActions';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { CalendarView, CalendarFilters, LessonWithDetails } from '@/components/calendar/types';
import { buildTeacherColourMap } from '@/components/calendar/teacherColours';
import { CalendarMobileLayout } from '@/components/calendar/CalendarMobileLayout';
import { CalendarDesktopLayout } from '@/components/calendar/CalendarDesktopLayout';
import { LessonModal } from '@/components/calendar/LessonModal';
import { LessonDetailPanel } from '@/components/calendar/LessonDetailPanel';
import { RecurringActionDialog } from '@/components/calendar/RecurringActionDialog';

const LG_QUERY = '(min-width: 1024px)';
const subscribe = (cb: () => void) => { const mql = window.matchMedia(LG_QUERY); mql.addEventListener('change', cb); return () => mql.removeEventListener('change', cb); };
const getSnapshot = () => window.matchMedia(LG_QUERY).matches;
function useIsDesktop() { return useSyncExternalStore(subscribe, getSnapshot, () => true); }

export default function CalendarPage() {
  const { currentRole, currentOrg } = useOrg();
  const { user } = useAuth();
  const isParent = currentRole === 'parent';
  const { teachers, locations, rooms, instruments } = useTeachersAndLocations();
  const [searchParams] = useSearchParams();
  const { checkConflicts } = useConflictDetection();
  const { isOnline } = useOnlineStatus();
  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();

  const [currentDate, setCurrentDateRaw] = useState(() => {
    const dateParam = searchParams.get('date');
    return dateParam ? parseISO(dateParam) : new Date();
  });
  const [view, setViewRaw] = useState<CalendarView>(() => {
    const v = searchParams.get('view');
    return (v === 'day' || v === 'week' || v === 'stacked' || v === 'agenda') ? v : 'day';
  });
  const [isCompact, setIsCompact] = useState(() => safeGetItem('ll-calendar-compact') === '1');
  const [groupByTeacher, setGroupByTeacher] = useState(false);
  const [filters, setFiltersRaw] = useState<CalendarFilters>(() => ({
    teacher_id: searchParams.get('teacher') || null,
    location_id: searchParams.get('location') || null,
    room_id: searchParams.get('room') || null,
    instrument: searchParams.get('instrument') || null,
    hide_cancelled: searchParams.get('hide_cancelled') === '1',
  }));

  // Sync state changes to URL (replaceState to avoid history spam)
  const syncToUrl = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  };

  const setCurrentDate = useCallback((d: Date) => {
    setCurrentDateRaw(d);
    syncToUrl({ date: format(d, 'yyyy-MM-dd') });
  }, []);
  const setView = useCallback((v: CalendarView) => {
    setViewRaw(v);
    syncToUrl({ view: v === 'day' ? null : v });
  }, []);
  const setFilters = useCallback((f: CalendarFilters | ((prev: CalendarFilters) => CalendarFilters)) => {
    setFiltersRaw(prev => {
      const next = typeof f === 'function' ? f(prev) : f;
      syncToUrl({
        teacher: next.teacher_id,
        location: next.location_id,
        room: next.room_id,
        instrument: next.instrument,
        hide_cancelled: next.hide_cancelled ? '1' : null,
      });
      return next;
    });
  }, []);

  useEffect(() => { safeSetItem('ll-calendar-compact', isCompact ? '1' : '0'); }, [isCompact]);

  const { lessons, setLessons, isLoading, isCapReached, refetch } = useCalendarData(currentDate, view, filters);

  const actions = useCalendarActions({
    lessons, setLessons, refetch,
    currentOrg, user,
    checkConflicts, isOnline, isMobile, isDesktop, isParent,
  });

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

  const teacherColourMap = useMemo(() => buildTeacherColourMap(teachers), [teachers]);
  const teachersWithColours = useMemo(() => Array.from(teacherColourMap.values()), [teacherColourMap]);

  const navigatePrev = useCallback(() => setCurrentDate(view === 'day' ? subDays(currentDate, 1) : subWeeks(currentDate, 1)), [currentDate, setCurrentDate, view]);
  const navigateNext = useCallback(() => setCurrentDate(view === 'day' ? addDays(currentDate, 1) : addWeeks(currentDate, 1)), [currentDate, setCurrentDate, view]);
  const goToToday = useCallback(() => setCurrentDate(new Date()), [setCurrentDate]);

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
  }, [actions, goToToday, isParent, navigateNext, navigatePrev, setView]);

  useEffect(() => {
    if (searchParams.get('action') === 'new' && !isParent && !actions.isModalOpen) {
      actions.openNewLessonModal();
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      window.history.replaceState(null, '', `?${newParams.toString()}`);
    }
  }, [searchParams, isParent, actions]);

  const sharedProps = {
    currentDate, setCurrentDate, goToToday,
    lessons, lessonsByDay, isLoading, isParent, isOnline,
    filters, setFilters, teachers, locations, rooms, instruments,
    teachersWithColours, teacherColourMap, actions,
  };

  return (
    <>
      {isMobile ? (
        <CalendarMobileLayout {...sharedProps} isCapReached={isCapReached} />
      ) : (
        <CalendarDesktopLayout
          {...sharedProps}
          view={view} setView={setView}
          isCompact={isCompact} setIsCompact={setIsCompact}
          groupByTeacher={groupByTeacher} setGroupByTeacher={setGroupByTeacher}
          navigatePrev={navigatePrev} navigateNext={navigateNext}
          isCapReached={isCapReached} isDesktop={isDesktop} refetch={refetch}
        />
      )}

      <LessonModal open={actions.isModalOpen} onClose={actions.handleModalClose} onSaved={actions.handleSaved} lesson={actions.selectedLesson} initialDate={actions.slotDate} initialEndDate={actions.slotEndDate} />
      <LessonDetailPanel lesson={actions.detailLesson} open={actions.detailPanelOpen} onClose={() => actions.setDetailPanelOpen(false)} onEdit={actions.handleEditFromDetail} onUpdated={refetch} />
      <RecurringActionDialog open={actions.recurringDialogOpen} onClose={actions.closeRecurringDialog} onSelect={actions.handleRecurringSelect} action="edit" />
    </>
  );
}
