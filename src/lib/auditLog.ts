import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Fire-and-forget audit log helper.
 * Inserts into audit_log without blocking the caller.
 */
export function logAudit(
  orgId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }
) {
  supabase
    .from('audit_log')
    .insert([{
      org_id: orgId,
      actor_user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before: (details?.before ?? null) as any,
      after: (details?.after ?? null) as any,
    }])
    .then(({ error }) => {
      if (error) logger.warn('[audit] Failed to log:', error.message);
    });
}
