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
   * Sync multiple lessons in parallel chunks (e.g. recurring series).
   * Processes CHUNK_SIZE at a time to avoid overloading the browser
   * connection pool or triggering 429 rate limits on large batches.
   */
  const syncLessons = useCallback(
    async (lessonIds: string[], action: 'create' | 'update' | 'delete') => {
      const CHUNK_SIZE = 10;
      for (let i = 0; i < lessonIds.length; i += CHUNK_SIZE) {
        const chunk = lessonIds.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(id => syncLesson(id, action)));
      }
    },
    [syncLesson]
  );

  return { syncLesson, syncLessons };
}
