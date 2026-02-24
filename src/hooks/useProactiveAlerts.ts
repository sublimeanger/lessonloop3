import { useQuery } from '@tanstack/react-query';
import { STALE_VOLATILE } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { startOfDay, endOfDay, format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export interface ProactiveAlert {
  type: 'overdue' | 'cancellation' | 'upcoming' | 'unmarked' | 'makeup_match' | 'unmarked_reason' | 'churn_risk' | 'practice_drop';
  severity: 'info' | 'warning' | 'urgent';
  message: string;
  suggestedAction?: string;
  count?: number;
}

export function useProactiveAlerts() {
  const { currentOrg } = useOrg();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['proactive-alerts', currentOrg?.id],
    queryFn: async (): Promise<ProactiveAlert[]> => {
      if (!currentOrg?.id) return [];

      const tz = currentOrg.timezone || 'Europe/London';
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd'); // for DATE column comparisons (due_date)
      const todayStartUtc = fromZonedTime(startOfDay(now), tz).toISOString();
      const todayEndUtc = fromZonedTime(endOfDay(now), tz).toISOString();
      const weekAgoUtc = fromZonedTime(startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), tz).toISOString();
      const alerts: ProactiveAlert[] = [];

      // Check overdue invoices
      const { data: overdueInvoices, count: overdueCount } = await supabase
        .from('invoices')
        .select('id, due_date', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .eq('status', 'overdue')
        .limit(1);

      if (overdueCount && overdueCount > 0) {
        // Check for critical (30+ days overdue)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { count: criticalCount } = await supabase
          .from('invoices')
          .select('id', { count: 'exact' })
          .eq('org_id', currentOrg.id)
          .eq('status', 'overdue')
          .lt('due_date', thirtyDaysAgo);

        alerts.push({
          type: 'overdue',
          severity: (criticalCount && criticalCount > 0) ? 'urgent' : 'warning',
          message: `${overdueCount} invoice${overdueCount > 1 ? 's are' : ' is'} overdue`,
          suggestedAction: 'Send payment reminders',
          count: overdueCount,
        });
      }

      // Check unmarked past lessons
      const { count: unmarkedCount } = await supabase
        .from('lessons')
        .select('id', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .eq('status', 'scheduled')
        .lt('start_at', todayStartUtc)
        .gte('start_at', weekAgoUtc);

      if (unmarkedCount && unmarkedCount > 0) {
        alerts.push({
          type: 'unmarked',
          severity: 'warning',
          message: `${unmarkedCount} past lesson${unmarkedCount > 1 ? 's need' : ' needs'} marking`,
          suggestedAction: 'Mark lessons as complete',
          count: unmarkedCount,
        });
      }

      // Check recent cancellations without rescheduling
      const { count: cancellationCount } = await supabase
        .from('lessons')
        .select('id', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .eq('status', 'cancelled')
        .gte('start_at', weekAgoUtc);

      if (cancellationCount && cancellationCount > 0) {
        alerts.push({
          type: 'cancellation',
          severity: 'info',
          message: `${cancellationCount} lesson${cancellationCount > 1 ? 's were' : ' was'} cancelled this week`,
          suggestedAction: 'Review and reschedule if needed',
          count: cancellationCount,
        });
      }

      // Check upcoming lessons today
      const { count: upcomingCount } = await supabase
        .from('lessons')
        .select('id', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .eq('status', 'scheduled')
        .gte('start_at', todayStartUtc)
        .lte('start_at', todayEndUtc);

      if (upcomingCount && upcomingCount > 0) {
        alerts.push({
          type: 'upcoming',
          severity: 'info',
          message: `${upcomingCount} lesson${upcomingCount > 1 ? 's' : ''} scheduled for today`,
          count: upcomingCount,
        });
      }

      // Check make-up matches needing action
      const { count: matchedCount } = await supabase
        .from('make_up_waitlist')
        .select('id', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .eq('status', 'matched');

      if (matchedCount && matchedCount > 0) {
        alerts.push({
          type: 'makeup_match',
          severity: 'info',
          message: `${matchedCount} make-up match${matchedCount > 1 ? 'es' : ''} found`,
          suggestedAction: 'Review and offer to parents',
          count: matchedCount,
        });
      }

      // Check absences missing reasons (last 7 days) — exclude cancelled lessons
      const { data: cancelledLessonIds } = await supabase
        .from('lessons')
        .select('id')
        .eq('org_id', currentOrg.id)
        .eq('status', 'cancelled');

      let missingReasonQuery = supabase
        .from('attendance_records')
        .select('id', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .in('attendance_status', ['absent', 'cancelled_by_student'])
        .is('absence_reason_category', null)
        .gte('recorded_at', weekAgoUtc);

      if (cancelledLessonIds && cancelledLessonIds.length > 0) {
        const ids = cancelledLessonIds.map(l => l.id);
        missingReasonQuery = missingReasonQuery.not('lesson_id', 'in', `(${ids.join(',')})`);
      }

      const { count: missingReasonCount } = await missingReasonQuery;

      if (missingReasonCount && missingReasonCount > 0) {
        alerts.push({
          type: 'unmarked_reason',
          severity: 'warning',
          message: `${missingReasonCount} absence${missingReasonCount > 1 ? 's' : ''} missing a reason`,
          suggestedAction: 'Add absence reasons to enable make-up matching',
          count: missingReasonCount,
        });
      }

      // Check for churn risk: students with 2+ absences in last 30 days
      const thirtyDaysAgoUtc = fromZonedTime(startOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), tz).toISOString();
      const { data: frequentAbsences } = await supabase
        .from('attendance_records')
        .select('student_id')
        .eq('org_id', currentOrg.id)
        .in('attendance_status', ['absent', 'cancelled_by_student'])
        .gte('recorded_at', thirtyDaysAgoUtc);

      if (frequentAbsences) {
        const absentCounts = new Map<string, number>();
        frequentAbsences.forEach(a => {
          absentCounts.set(a.student_id, (absentCounts.get(a.student_id) || 0) + 1);
        });
        const atRiskStudents = Array.from(absentCounts.entries()).filter(([_, count]) => count >= 2);
        if (atRiskStudents.length > 0) {
          alerts.push({
            type: 'churn_risk',
            severity: 'warning',
            message: `${atRiskStudents.length} student${atRiskStudents.length > 1 ? 's have' : ' has'} missed 2+ lessons this month`,
            suggestedAction: 'Which students are at risk of leaving?',
            count: atRiskStudents.length,
          });
        }
      }

      // Practice engagement drop — students who haven't logged practice in 14+ days
      const fourteenDaysAgoStr = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: inactiveStreaks, count: inactivePracticeCount } = await supabase
        .from('practice_streaks')
        .select('id', { count: 'exact' })
        .eq('org_id', currentOrg.id)
        .lt('last_practice_date', fourteenDaysAgoStr);

      if (inactivePracticeCount && inactivePracticeCount > 0) {
        alerts.push({
          type: 'practice_drop',
          severity: 'info',
          message: `${inactivePracticeCount} student${inactivePracticeCount > 1 ? 's haven\'t' : ' hasn\'t'} practised in 2+ weeks`,
          suggestedAction: 'Draft practice encouragement messages',
          count: inactivePracticeCount,
        });
      }

      return alerts;
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 60000, // Refresh every minute
    staleTime: STALE_VOLATILE,
  });

  const criticalCount = alerts.filter(a => a.severity === 'urgent').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const totalActionable = criticalCount + warningCount;

  return {
    alerts,
    isLoading,
    criticalCount,
    warningCount,
    totalActionable,
    hasCritical: criticalCount > 0,
  };
}
