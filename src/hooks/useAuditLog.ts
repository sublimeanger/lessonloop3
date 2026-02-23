import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { Json } from '@/integrations/supabase/types';

export interface AuditLogEntry {
  id: string;
  org_id: string;
  actor_user_id: string | null;
  actor_name?: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

function jsonToRecord(json: Json | null): Record<string, unknown> | null {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return null;
  }
  return json as Record<string, unknown>;
}

interface UseAuditLogOptions {
  entityType?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export function useAuditLog(options: UseAuditLogOptions = {}) {
  const { currentOrg } = useOrg();
  const { entityType, action, startDate, endDate, limit = 100 } = options;

  return useQuery({
    queryKey: ['audit-log', currentOrg?.id, entityType, action, startDate, endDate, limit],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      if (!currentOrg) return [];

      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      if (action) {
        query = query.eq('action', action);
      }

      if (startDate) {
        query = query.gte('created_at', `${startDate}T00:00:00`);
      }

      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch actor names
      const actorIds = [...new Set((data || []).filter(e => e.actor_user_id).map(e => e.actor_user_id!))];
      
      const actorMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', actorIds);

        for (const profile of profiles || []) {
          actorMap.set(profile.id, profile.full_name || profile.email || 'Unknown');
        }
      }

      return (data || []).map(entry => ({
        id: entry.id,
        org_id: entry.org_id,
        actor_user_id: entry.actor_user_id,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        before: jsonToRecord(entry.before),
        after: jsonToRecord(entry.after),
        created_at: entry.created_at,
        actor_name: entry.actor_user_id ? actorMap.get(entry.actor_user_id) || 'Unknown' : 'System',
      }));
    },
    enabled: !!currentOrg,
  });
}

export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
  };
  return labels[action] || action;
}

export function getEntityLabel(entityType: string): string {
  const labels: Record<string, string> = {
    students: 'Student',
    lessons: 'Lesson',
    invoices: 'Invoice',
    payments: 'Payment',
    org_memberships: 'Membership',
  };
  return labels[entityType] || entityType;
}

export function getChangeDescription(entry: AuditLogEntry): string {
  const entityLabel = getEntityLabel(entry.entity_type);
  const actionLabel = getActionLabel(entry.action).toLowerCase();
  
  if (entry.action === 'create' && entry.after) {
    if (entry.entity_type === 'students') {
      const name = `${entry.after.first_name || ''} ${entry.after.last_name || ''}`.trim();
      return `${entityLabel} "${name}" was created`;
    }
    if (entry.entity_type === 'lessons') {
      return `Lesson "${entry.after.title || 'Untitled'}" was scheduled`;
    }
    if (entry.entity_type === 'invoices') {
      return `Invoice ${entry.after.invoice_number || ''} was created`;
    }
    if (entry.entity_type === 'payments') {
      const amount = ((entry.after.amount_minor as number) || 0) / 100;
      return `Payment of £${amount.toFixed(2)} was recorded`;
    }
    if (entry.entity_type === 'org_memberships') {
      return `Member was added with role "${entry.after.role}"`;
    }
  }

  if (entry.action === 'update') {
    if (entry.entity_type === 'invoices' && entry.before && entry.after) {
      if (entry.before.status !== entry.after.status) {
        return `Invoice ${entry.after.invoice_number || ''} status changed from "${entry.before.status}" to "${entry.after.status}"`;
      }
    }
    if (entry.entity_type === 'lessons' && entry.before && entry.after) {
      if (entry.before.status !== entry.after.status) {
        return `Lesson "${entry.after.title || 'Untitled'}" was ${entry.after.status}`;
      }
    }
    if (entry.entity_type === 'org_memberships' && entry.before && entry.after) {
      if (entry.before.role !== entry.after.role) {
        return `Member role changed from "${entry.before.role}" to "${entry.after.role}"`;
      }
    }
  }

  if (entry.action === 'delete') {
    if (entry.entity_type === 'students' && entry.before) {
      const name = `${entry.before.first_name || ''} ${entry.before.last_name || ''}`.trim();
      return `${entityLabel} "${name}" was deleted`;
    }
  }

  return `${entityLabel} was ${actionLabel}`;
}
