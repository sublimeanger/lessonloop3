import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a base Supabase query builder for active, non-deleted students.
 * Callers MUST chain `.select(...)` after this.
 *
 * Usage:
 *   activeStudentsQuery(orgId).select('id, first_name').order('first_name')
 *
 * @param orgId – The organisation ID to scope the query
 */
export function activeStudentsQuery(orgId: string) {
  return supabase
    .from('students')
    .select()
    .eq('org_id', orgId)
    .eq('status', 'active' as any)
    .is('deleted_at', null);
}
