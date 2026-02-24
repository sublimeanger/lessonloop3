import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Fire-and-forget Zoom meeting sync. Never blocks the UI or shows errors
 * to the user — Zoom sync is best-effort, not critical path.
 */
export function useZoomSync() {
  const syncZoomMeeting = useCallback(
    (lessonId: string, action: 'create' | 'update' | 'delete') => {
      supabase.functions
        .invoke('zoom-sync-lesson', {
          body: { lesson_id: lessonId, action },
        })
        .then(({ data, error }) => {
          if (error) {
            logger.warn('Zoom sync failed (non-critical):', error.message);
          } else if (data && !data.success && data.error) {
            logger.warn('Zoom sync issue:', data.error);
          }
        })
        .catch((e) => {
          // Silently swallow — Zoom sync must never break lesson operations
          logger.warn('Zoom sync exception (non-critical):', e);
        });
    },
    []
  );

  /**
   * Sync multiple lessons at once (e.g. recurring series).
   * Each call is independent and fire-and-forget.
   */
  const syncZoomMeetings = useCallback(
    (lessonIds: string[], action: 'create' | 'update' | 'delete') => {
      for (const id of lessonIds) {
        syncZoomMeeting(id, action);
      }
    },
    [syncZoomMeeting]
  );

  return { syncZoomMeeting, syncZoomMeetings };
}
