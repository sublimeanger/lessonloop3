import { useState, useCallback } from 'react';
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
}

export function useBulkLessonActions({ refetch, orgId, userId }: UseBulkLessonActionsParams) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((lessons: LessonWithDetails[]) => {
    setSelectedIds(new Set(lessons.map(l => l.id)));
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
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });

    let successCount = 0;
    let failCount = 0;

    // Sequential updates to avoid RLS/rate limit issues
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const updateData: Record<string, unknown> = {};
      if (payload.teacher_id !== undefined) updateData.teacher_id = payload.teacher_id;
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
  }, [selectedIds, orgId, userId, refetch, exitSelectionMode]);

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
