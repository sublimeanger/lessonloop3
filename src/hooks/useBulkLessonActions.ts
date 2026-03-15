import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAudit } from '@/lib/auditLog';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { LessonWithDetails, LessonStatus, LessonType } from '@/components/calendar/types';

export interface BulkEditPayload {
  teacher_id?: string | null;
  location_id?: string | null;
  room_id?: string | null;
  status?: LessonStatus;
  lesson_type?: LessonType;
}

interface UseBulkLessonActionsParams {
  refetch: () => void;
  orgId: string | null;
  userId: string | null;
  currentRole?: string | null;
  teacherId?: string | null;
}

export function useBulkLessonActions({ refetch, orgId, userId, currentRole, teacherId: myTeacherId }: UseBulkLessonActionsParams) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const isMounted = useRef(true);

  useEffect(() => () => { isMounted.current = false; }, []);

  const MAX_BULK = 100;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_BULK) {
          toast({ title: 'Selection limit reached', description: `Maximum ${MAX_BULK} lessons can be selected at once.` });
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((lessons: LessonWithDetails[]) => {
    if (lessons.length > MAX_BULK) {
      toast({ title: 'Selection limit reached', description: `Only the first ${MAX_BULK} lessons were selected.` });
      setSelectedIds(new Set(lessons.slice(0, MAX_BULK).map(l => l.id)));
    } else {
      setSelectedIds(new Set(lessons.map(l => l.id)));
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
  }, []);

  const bulkUpdate = useCallback(async (payload: BulkEditPayload) => {
    if (selectedIds.size === 0 || !orgId || !userId) return;

    setIsBulkUpdating(true);
    let ids = Array.from(selectedIds);

    // FIX 1: Role check — teachers can only edit their own lessons
    if (currentRole === 'teacher' && userId) {
      const filterQuery = supabase
        .from('lessons')
        .select('id')
        .in('id', ids);

      if (myTeacherId) {
        filterQuery.or(`teacher_user_id.eq.${userId},teacher_id.eq.${myTeacherId}`);
      } else {
        filterQuery.eq('teacher_user_id', userId);
      }

      const { data: myLessons, error: filterErr } = await filterQuery;
      if (filterErr) {
        logger.warn('[bulk-edit] Failed to filter lessons by ownership:', filterErr.message);
      }

      const allowedIds = new Set((myLessons || []).map(l => l.id));
      const skipped = ids.length - allowedIds.size;
      ids = ids.filter(id => allowedIds.has(id));

      if (skipped > 0) {
        toast({
          title: 'Some lessons skipped',
          description: `${skipped} lesson${skipped !== 1 ? 's' : ''} belong to other teachers and were not modified.`,
        });
      }
    }

    // FIX 2: Prevent cancelling completed lessons
    if (payload.status === 'cancelled' && ids.length > 0) {
      const { data: completedLessons } = await supabase
        .from('lessons')
        .select('id')
        .in('id', ids)
        .eq('status', 'completed');

      const completedIds = new Set((completedLessons || []).map(l => l.id));
      if (completedIds.size > 0) {
        ids = ids.filter(id => !completedIds.has(id));
        toast({
          title: 'Completed lessons skipped',
          description: `${completedIds.size} completed lesson${completedIds.size !== 1 ? 's' : ''} cannot be cancelled.`,
        });
      }
    }

    if (ids.length === 0) {
      setIsBulkUpdating(false);
      toast({ title: 'No lessons to update', description: 'All selected lessons were filtered out.' });
      exitSelectionMode();
      return;
    }

    setBulkProgress({ done: 0, total: ids.length });

    // FIX 3: If changing teacher, look up teacher_user_id and warn about attendance
    let resolvedTeacherUserId: string | null | undefined = undefined;
    if (payload.teacher_id) {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('user_id')
        .eq('id', payload.teacher_id)
        .single();
      resolvedTeacherUserId = teacher?.user_id ?? null;

      // Warn about existing attendance
      const { count: attCount } = await supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true })
        .in('lesson_id', ids);
      if (attCount && attCount > 0) {
        toast({
          title: 'Warning',
          description: `${attCount} attendance record${attCount !== 1 ? 's' : ''} exist for these lessons. Teacher change may affect reports.`,
        });
      }
    }

    let successCount = 0;
    let failCount = 0;

    // Sequential updates to avoid RLS/rate limit issues
    for (let i = 0; i < ids.length; i++) {
      // FIX 4: Check if component unmounted mid-loop
      if (!isMounted.current) {
        toast({ title: 'Update interrupted', description: `${successCount} of ${ids.length} lessons updated before navigating away.` });
        break;
      }

      const id = ids[i];
      const updateData: Record<string, unknown> = {};
      if (payload.teacher_id !== undefined) {
        updateData.teacher_id = payload.teacher_id;
        if (resolvedTeacherUserId !== undefined) {
          updateData.teacher_user_id = resolvedTeacherUserId;
        }
      }
      if (payload.location_id !== undefined) updateData.location_id = payload.location_id;
      if (payload.room_id !== undefined) updateData.room_id = payload.room_id;
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.lesson_type !== undefined) updateData.lesson_type = payload.lesson_type;

      const { error } = await supabase
        .from('lessons')
        .update(updateData)
        .eq('id', id);

      if (error) {
        logger.warn(`[bulk-edit] Failed to update lesson ${id}:`, error.message);
        failCount++;
      } else {
        successCount++;
      }
      setBulkProgress({ done: i + 1, total: ids.length });
    }

    // Single audit log entry
    logAudit(orgId, userId, 'bulk_update', 'lesson', null, {
      after: { count: successCount, fields: Object.keys(payload), lesson_ids: ids } as any,
    });

    setIsBulkUpdating(false);

    if (failCount === 0) {
      toast({ title: 'Bulk update complete', description: `${successCount} lesson${successCount !== 1 ? 's' : ''} updated.` });
    } else {
      toast({ title: 'Bulk update finished with errors', description: `${successCount} updated, ${failCount} failed.`, variant: 'destructive' });
    }

    exitSelectionMode();
    refetch();
  }, [selectedIds, orgId, userId, currentRole, myTeacherId, refetch, exitSelectionMode]);

  const bulkCancel = useCallback(async () => {
    await bulkUpdate({ status: 'cancelled' as LessonStatus });
  }, [bulkUpdate]);

  return {
    selectionMode,
    selectedIds,
    isBulkUpdating,
    bulkProgress,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkUpdate,
    bulkCancel,
  };
}
