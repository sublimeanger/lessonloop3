import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format } from 'date-fns';

export interface UrgentAction {
  id: string;
  type: 'unmarked_lessons' | 'overdue_invoices' | 'pending_requests' | 'unreviewed_practice';
  count: number;
  label: string;
  href: string;
  severity: 'warning' | 'error';
}

export function useUrgentActions() {
  const { currentOrg, currentRole } = useOrg();
  const { user } = useAuth();

  const isAdmin = currentRole === 'owner' || currentRole === 'admin';
  const isTeacher = currentRole === 'teacher';
  const isFinance = currentRole === 'finance';

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['urgent-actions', currentOrg?.id, user?.id, currentRole],
    queryFn: async (): Promise<UrgentAction[]> => {
      if (!currentOrg || !user) return [];

      const urgentActions: UrgentAction[] = [];

      try {
        // Fetch unmarked lessons (for admins and teachers)
        if (isAdmin || isTeacher) {
          let query = supabase
            .from('lessons')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id)
            .eq('status', 'scheduled')
            .lt('end_at', new Date().toISOString());

          if (isTeacher && !isAdmin) {
            const { data: teacherRecord } = await supabase
              .from('teachers')
              .select('id')
              .eq('user_id', user.id)
              .eq('org_id', currentOrg.id)
              .maybeSingle();
            if (teacherRecord) {
              query = query.eq('teacher_id', teacherRecord.id);
            }
          }

          const { count: unmarkedCount } = await query;

          if (unmarkedCount && unmarkedCount > 0) {
            urgentActions.push({
              id: 'unmarked-lessons',
              type: 'unmarked_lessons',
              count: unmarkedCount,
              label: unmarkedCount === 1 ? 'unmarked lesson' : 'unmarked lessons',
              href: '/register',
              severity: 'warning',
            });
          }
        }

        // Fetch overdue invoices (for admins and finance)
        if (isAdmin || isFinance) {
          const sevenDaysAgo = subDays(new Date(), 7);

          const { count: overdueCount } = await supabase
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id)
            .in('status', ['sent', 'overdue'])
            .lt('due_date', format(sevenDaysAgo, 'yyyy-MM-dd'));

          if (overdueCount && overdueCount > 0) {
            urgentActions.push({
              id: 'overdue-invoices',
              type: 'overdue_invoices',
              count: overdueCount,
              label: overdueCount === 1 ? 'overdue invoice' : 'overdue invoices',
              href: '/invoices?status=overdue',
              severity: 'error',
            });
          }
        }

        // Fetch pending message requests (for admins)
        if (isAdmin) {
          const { count: requestsCount } = await supabase
            .from('message_requests')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id)
            .eq('status', 'pending');

          if (requestsCount && requestsCount > 0) {
            urgentActions.push({
              id: 'pending-requests',
              type: 'pending_requests',
              count: requestsCount,
              label: requestsCount === 1 ? 'pending request' : 'pending requests',
              href: '/messages?tab=requests',
              severity: 'warning',
            });
          }
        }

        // Fetch unreviewed practice logs (for teachers)
        if (isAdmin || isTeacher) {
          let query: any = supabase
            .from('practice_logs')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id)
            .is('reviewed_at', null);

          if (isTeacher && !isAdmin) {
            const { data: teacherRecord } = await supabase
              .from('teachers')
              .select('id')
              .eq('user_id', user.id)
              .eq('org_id', currentOrg.id)
              .maybeSingle();

            const { data: assignments } = await supabase
              .from('student_teacher_assignments')
              .select('student_id, students!inner(id, status)')
              .eq('teacher_id', teacherRecord?.id || '')
              .eq('org_id', currentOrg.id)
              .eq('students.status', 'active');

            const studentIds = assignments?.map(a => a.student_id) || [];
            if (studentIds.length > 0) {
              query = query.in('student_id', studentIds);
            } else {
              query = null;
            }
          }

          if (query) {
            const { count: practiceCount } = await query;

            if (practiceCount && practiceCount > 0) {
              urgentActions.push({
                id: 'unreviewed-practice',
                type: 'unreviewed_practice',
                count: practiceCount,
                label: practiceCount === 1 ? 'practice log to review' : 'practice logs to review',
                href: '/practice',
                severity: 'warning',
              });
            }
          }
        }

        return urgentActions;
      } catch (error) {
        logger.error('Error fetching urgent actions:', error);
        return [];
      }
    },
    enabled: !!currentOrg && !!user,
    // Uses default SEMI_STABLE (2 min)
    refetchInterval: 120_000,
  });

  return {
    actions,
    isLoading,
    hasActions: actions.length > 0,
    totalCount: actions.reduce((sum, a) => sum + a.count, 0),
  };
}
