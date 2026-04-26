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
    // Trigger-emitted CRUD verbs (post-T01-P3 standard, LOWER(TG_OP))
    insert: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    // Domain verbs from logAudit() callers — kept distinct from CRUD
    create: 'Created',
    cancel: 'Cancelled',
    reschedule: 'Rescheduled',
    bulk_cancel: 'Bulk cancelled',
    bulk_update: 'Bulk updated',
    warning: 'Warning',
    invoice_edited: 'Invoice edited',
    payment_recorded: 'Payment recorded',
  };
  return labels[action] || action;
}

export function getEntityLabel(entityType: string): string {
  const labels: Record<string, string> = {
    // T01-P3 normalised — all singular
    student: 'Student',
    lesson: 'Lesson',
    invoice: 'Invoice',
    payment: 'Payment',
    org_membership: 'Membership',
    teacher: 'Teacher',
    internal_message: 'Message',
    ai_action_proposal: 'AI proposal',
    attendance_record: 'Attendance',
    practice_streak: 'Practice streak',
    calendar_connection: 'Calendar connection',
    xero_connection: 'Xero connection',
    // T01-P1 walk-surfaced + parent-tables singular labels
    refund: 'Refund',
    make_up_credit: 'Make-up credit',
    term_adjustment: 'Term adjustment',
    invoice_installment: 'Invoice installment',
    invoice_item: 'Invoice item',
    billing_run: 'Billing run',
    rate_card: 'Rate card',
    teacher_profile: 'Teacher profile',
    guardian: 'Guardian',
    lesson_participant: 'Lesson participant',
    student_guardian: 'Student-guardian link',
    term: 'Term',
    recurring_invoice_template: 'Recurring template',
    recurring_template_item: 'Recurring template item',
    recurring_template_recipient: 'Recurring template recipient',
    guardian_payment_preference: 'Guardian payment preference',
    profile: 'Profile',
    make_up_waitlist: 'Make-up waitlist',
    continuation_response: 'Continuation response',
  };
  return labels[entityType] || entityType;
}

export function getChangeDescription(entry: AuditLogEntry): string {
  const entityLabel = getEntityLabel(entry.entity_type);
  const actionLabel = getActionLabel(entry.action).toLowerCase();

  // INSERT path — trigger-emitted CRUD insert. 'create' is also accepted as
  // a logAudit() domain-verb fallback, since some callers in src/ deliberately
  // write 'create' to express "user created this" rather than CRUD insert.
  if ((entry.action === 'insert' || entry.action === 'create') && entry.after) {
    if (entry.entity_type === 'student') {
      const name = `${entry.after.first_name || ''} ${entry.after.last_name || ''}`.trim();
      return `${entityLabel} "${name}" was created`;
    }
    if (entry.entity_type === 'lesson') {
      return `Lesson "${entry.after.title || 'Untitled'}" was scheduled`;
    }
    if (entry.entity_type === 'invoice') {
      return `Invoice ${entry.after.invoice_number || ''} was created`;
    }
    if (entry.entity_type === 'payment') {
      const amount = ((entry.after.amount_minor as number) || 0) / 100;
      return `Payment of £${amount.toFixed(2)} was recorded`;
    }
    if (entry.entity_type === 'org_membership') {
      return `Member was added with role "${entry.after.role}"`;
    }
  }

  if (entry.action === 'update') {
    if (entry.entity_type === 'invoice' && entry.before && entry.after) {
      if (entry.before.status !== entry.after.status) {
        return `Invoice ${entry.after.invoice_number || ''} status changed from "${entry.before.status}" to "${entry.after.status}"`;
      }
    }
    if (entry.entity_type === 'lesson' && entry.before && entry.after) {
      if (entry.before.status !== entry.after.status) {
        return `Lesson "${entry.after.title || 'Untitled'}" was ${entry.after.status}`;
      }
    }
    if (entry.entity_type === 'org_membership' && entry.before && entry.after) {
      if (entry.before.role !== entry.after.role) {
        return `Member role changed from "${entry.before.role}" to "${entry.after.role}"`;
      }
    }
  }

  if (entry.action === 'delete') {
    if (entry.entity_type === 'student' && entry.before) {
      const name = `${entry.before.first_name || ''} ${entry.before.last_name || ''}`.trim();
      return `${entityLabel} "${name}" was deleted`;
    }
  }

  return `${entityLabel} was ${actionLabel}`;
}
