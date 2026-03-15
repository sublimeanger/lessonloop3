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

interface BulkLessonResult {
  updated_count: number;
  skipped_ids: string[];
  skipped_reasons: string[];
  conflict_ids: string[];
  conflict_details: string[];
}

interface UseBulkLessonActionsParams {
  refetch: () => void;
  orgId: string | null;
  userId: string | null;
  currentRole?: string | null;
  teacherId?: string | null;
}

export function useBulkLessonActions({ refetch, orgId, userId }: UseBulkLessonActionsParams) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

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
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });

    try {
      // Build changes object — only include fields that were set
      const changes: Record<string, string | null> = {} as any;
      if (payload.teacher_id !== undefined) changes.teacher_id = payload.teacher_id;
      if (payload.location_id !== undefined) changes.location_id = payload.location_id;
      if (payload.room_id !== undefined) changes.room_id = payload.room_id;
      if (payload.status !== undefined) changes.status = payload.status;
      if (payload.lesson_type !== undefined) changes.lesson_type = payload.lesson_type;

      const { data, error } = await (supabase.rpc as any)('bulk_update_lessons', {
        p_lesson_ids: ids,
        p_changes: changes,
      });

      setBulkProgress({ done: ids.length, total: ids.length });

      if (error) {
        logger.warn('[bulk-edit] RPC failed:', error.message);
        toast({ title: 'Bulk update failed', description: error.message, variant: 'destructive' });
        setIsBulkUpdating(false);
        return;
      }

      const result = data as unknown as BulkLessonResult;

      // Audit log
      logAudit(orgId, userId, 'bulk_update', 'lesson', null, {
        after: { count: result.updated_count, fields: Object.keys(changes), lesson_ids: ids } as any,
      });

      // Build user feedback
      const messages: string[] = [];

      if (result.updated_count > 0) {
        messages.push(`${result.updated_count} lesson${result.updated_count !== 1 ? 's' : ''} updated`);
      }

      if (result.skipped_ids.length > 0) {
        // Group skip reasons for a cleaner message
        const reasonCounts = new Map<string, number>();
        for (const reason of result.skipped_reasons) {
          reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
        }
        const parts: string[] = [];
        for (const [reason, count] of reasonCounts) {
          parts.push(`${count} skipped: ${reason}`);
        }
        messages.push(parts.join('. '));
      }

      if (result.conflict_ids.length > 0) {
        messages.push(`${result.conflict_ids.length} skipped due to scheduling conflicts`);
      }

      const hasIssues = result.skipped_ids.length > 0 || result.conflict_ids.length > 0;

      if (result.updated_count === 0 && hasIssues) {
        toast({
          title: 'No lessons updated',
          description: messages.join('. ') || 'All selected lessons were filtered out.',
          variant: 'destructive',
        });
      } else if (hasIssues) {
        toast({
          title: 'Bulk update completed with warnings',
          description: messages.join('. '),
        });
      } else {
        toast({
          title: 'Bulk update complete',
          description: messages[0] || `${result.updated_count} lessons updated.`,
        });
      }
    } catch (err) {
      logger.warn('[bulk-edit] Unexpected error:', err);
      toast({ title: 'Bulk update failed', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsBulkUpdating(false);
      exitSelectionMode();
      refetch();
    }
  }, [selectedIds, orgId, userId, refetch, exitSelectionMode]);

  const bulkCancel = useCallback(async () => {
    if (selectedIds.size === 0 || !orgId || !userId) return;

    setIsBulkUpdating(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });

    try {
      const { data, error } = await supabase.rpc('bulk_cancel_lessons', {
        p_lesson_ids: ids,
      });

      setBulkProgress({ done: ids.length, total: ids.length });

      if (error) {
        logger.warn('[bulk-cancel] RPC failed:', error.message);
        toast({ title: 'Bulk cancel failed', description: error.message, variant: 'destructive' });
        setIsBulkUpdating(false);
        return;
      }

      const result = data as unknown as BulkLessonResult;

      logAudit(orgId, userId, 'bulk_cancel', 'lesson', null, {
        after: { count: result.updated_count, lesson_ids: ids } as any,
      });

      const messages: string[] = [];
      if (result.updated_count > 0) {
        messages.push(`${result.updated_count} lesson${result.updated_count !== 1 ? 's' : ''} cancelled`);
      }
      if (result.skipped_ids.length > 0) {
        const reasonCounts = new Map<string, number>();
        for (const reason of result.skipped_reasons) {
          reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
        }
        for (const [reason, count] of reasonCounts) {
          messages.push(`${count} skipped: ${reason}`);
        }
      }

      const hasIssues = result.skipped_ids.length > 0;

      if (result.updated_count === 0 && hasIssues) {
        toast({
          title: 'No lessons cancelled',
          description: messages.join('. ') || 'All selected lessons were filtered out.',
          variant: 'destructive',
        });
      } else if (hasIssues) {
        toast({ title: 'Bulk cancel completed with warnings', description: messages.join('. ') });
      } else {
        toast({ title: 'Bulk cancel complete', description: messages[0] || 'Done.' });
      }
    } catch (err) {
      logger.warn('[bulk-cancel] Unexpected error:', err);
      toast({ title: 'Bulk cancel failed', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsBulkUpdating(false);
      exitSelectionMode();
      refetch();
    }
  }, [selectedIds, orgId, userId, refetch, exitSelectionMode]);

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
