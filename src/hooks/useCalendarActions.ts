import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { toast } from '@/hooks/use-toast';
import { LessonWithDetails } from '@/components/calendar/types';
import { RecurringActionMode } from '@/components/calendar/RecurringActionDialog';
import type { ConflictResult } from '@/components/calendar/types';

interface UseCalendarActionsParams {
  lessons: LessonWithDetails[];
  setLessons: React.Dispatch<React.SetStateAction<LessonWithDetails[]>>;
  refetch: () => void;
  currentOrg: { id: string; name: string } | null;
  user: { id: string } | null;
  checkConflicts: (params: {
    start_at: Date;
    end_at: Date;
    teacher_user_id: string | null;
    room_id: string | null;
    location_id: string | null;
    student_ids: string[];
    exclude_lesson_id?: string;
  }) => Promise<ConflictResult[]>;
  isOnline: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isParent: boolean;
}

export function useCalendarActions({
  lessons,
  setLessons,
  refetch,
  currentOrg,
  user,
  checkConflicts,
  isMobile,
  isDesktop,
  isParent,
}: UseCalendarActionsParams) {
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

  // Track lesson IDs that are currently being saved (optimistic update in flight)
  const [savingLessonIds, setSavingLessonIds] = useState<Set<string>>(new Set());

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

  const handleEditFromDetail = useCallback(() => {
    setSelectedLesson(detailLesson);
    setSlotDate(undefined);
    setSlotEndDate(undefined);
    setDetailPanelOpen(false);
    setIsModalOpen(true);
  }, [detailLesson]);

  const handleEditFromSidePanel = useCallback((lesson: LessonWithDetails) => {
    setSidePanelOpen(false);
    setSelectedLesson(lesson);
    setSlotDate(undefined);
    setSlotEndDate(undefined);
    setIsModalOpen(true);
  }, []);

  const handleSidePanelAttendance = useCallback((_lesson: LessonWithDetails, _status: string) => {
    setSidePanelOpen(false);
    setDetailLesson(_lesson);
    setDetailPanelOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedLesson(null);
    setSlotDate(undefined);
    setSlotEndDate(undefined);
  }, []);

  const handleSaved = useCallback(() => {
    refetch();
    setDetailPanelOpen(false);
  }, [refetch]);

  // ─── Drag-to-reschedule handler ────────────────────────────
  const executeLessonMove = useCallback(
    async (lesson: LessonWithDetails, newStart: Date, newEnd: Date, mode: RecurringActionMode | 'single') => {
      const originalStartAt = lesson.start_at;
      const originalEndAt = lesson.end_at;

      const originalPositions = new Map<string, { start_at: string; end_at: string }>();
      const affectedIds = new Set<string>();
      if (mode === 'this_and_future' && lesson.recurrence_id) {
        lessons.forEach(l => {
          if (l.recurrence_id === lesson.recurrence_id && l.start_at >= lesson.start_at) {
            affectedIds.add(l.id);
            originalPositions.set(l.id, { start_at: l.start_at, end_at: l.end_at });
          }
        });
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
        originalPositions.set(lesson.id, { start_at: lesson.start_at, end_at: lesson.end_at });
        setLessons(prev => prev.map(l =>
          l.id === lesson.id
            ? { ...l, start_at: newStart.toISOString(), end_at: newEnd.toISOString() }
            : l
        ));
      }

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
        setLessons(prev => prev.map(l => {
          const original = originalPositions.get(l.id);
          return original ? { ...l, ...original } : l;
        }));
        refetch();
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
    [refetch, setLessons, lessons, currentOrg, user]
  );

  const handleLessonDrop = useCallback(
    async (lesson: LessonWithDetails, newStart: Date, newEnd: Date) => {
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

      if (conflicts.length > 0) {
        toast({
          title: 'Rescheduled with warnings',
          description: conflicts.map((c) => c.message).join('. '),
        });
      }

      if (lesson.recurrence_id) {
        setPendingDrag({ lesson, newStart, newEnd, type: 'move' });
        setRecurringDialogOpen(true);
        return;
      }

      await executeLessonMove(lesson, newStart, newEnd, 'single');
    },
    [checkConflicts, executeLessonMove]
  );

  // ─── Drag-to-resize handler ────────────────────────────────
  const handleLessonResize = useCallback(
    async (lesson: LessonWithDetails, newEnd: Date) => {
      const newStart = new Date(lesson.start_at);

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

      if (lesson.recurrence_id) {
        setPendingDrag({ lesson, newStart, newEnd, type: 'resize' });
        setRecurringDialogOpen(true);
        return;
      }

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

  const openNewLessonModal = useCallback((date?: Date) => {
    setSelectedLesson(null);
    setSlotDate(date);
    setSlotEndDate(undefined);
    setIsModalOpen(true);
  }, []);

  const openEditFromMobileSheet = useCallback((lesson: LessonWithDetails) => {
    setMobileSheetOpen(false);
    setSelectedLesson(lesson);
    setSlotDate(undefined);
    setSlotEndDate(undefined);
    setIsModalOpen(true);
  }, []);

  const openDetailFromMobileSheet = useCallback((lesson: LessonWithDetails) => {
    setMobileSheetOpen(false);
    setDetailLesson(lesson);
    setDetailPanelOpen(true);
  }, []);

  const closeRecurringDialog = useCallback(() => {
    setRecurringDialogOpen(false);
    setPendingDrag(null);
  }, []);

  return {
    // Modal state
    isModalOpen, selectedLesson, slotDate, slotEndDate,
    // Detail panel
    detailPanelOpen, setDetailPanelOpen, detailLesson,
    // Side panel
    sidePanelOpen, setSidePanelOpen, sidePanelLesson,
    // Mobile sheet
    mobileSheetOpen, setMobileSheetOpen, mobileSheetLesson,
    // Quick create
    quickCreateOpen, setQuickCreateOpen, quickCreateStart, quickCreateEnd,
    // Recurring dialog
    recurringDialogOpen, pendingDrag,
    // Saving
    savingLessonIds,
    // Handlers
    handleLessonClick,
    handleSlotClick,
    handleSlotDrag,
    handleQuickCreateOpenFullModal,
    handleEditFromDetail,
    handleEditFromSidePanel,
    handleSidePanelAttendance,
    handleModalClose,
    handleSaved,
    handleLessonDrop,
    handleLessonResize,
    handleRecurringSelect,
    closeRecurringDialog,
    openNewLessonModal,
    openEditFromMobileSheet,
    openDetailFromMobileSheet,
  };
}
