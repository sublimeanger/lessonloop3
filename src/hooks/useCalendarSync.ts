import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Fire-and-forget calendar sync. Never blocks the UI or shows errors
 * to the user — calendar sync is best-effort, not critical path.
 */
export function useCalendarSync() {
  const syncLesson = useCallback(
    (lessonId: string, action: 'create' | 'update' | 'delete') => {
      supabase.functions
        .invoke('calendar-sync-lesson', {
          body: { lesson_id: lessonId, action },
        })
        .then(({ data, error }) => {
          if (error) {
            logger.warn('Calendar sync failed (non-critical):', error.message);
          } else if (data && !data.success && data.error) {
            logger.warn('Calendar sync issue:', data.error);
          }
        })
        .catch((e) => {
          // Silently swallow — calendar sync must never break lesson operations
          logger.warn('Calendar sync exception (non-critical):', e);
        });
    },
    []
  );

  /**
   * Sync multiple lessons at once (e.g. recurring series).
   * Each call is independent and fire-and-forget.
   */
  const syncLessons = useCallback(
    (lessonIds: string[], action: 'create' | 'update' | 'delete') => {
      for (const id of lessonIds) {
        syncLesson(id, action);
      }
    },
    [syncLesson]
  );

  return { syncLesson, syncLessons };
}
