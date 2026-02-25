import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { useOrg } from '@/contexts/OrgContext';
import { STALE_REPORT } from '@/config/query-stale-times';
import {
  LEAD_STAGES,
  STAGE_LABELS,
  SOURCE_LABELS,
  type LeadStage,
  type LeadSource,
  type LeadListItem,
} from '@/hooks/useLeads';
import { sanitiseCSVCell } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FunnelStageData {
  stage: LeadStage;
  label: string;
  count: number;
  conversionRate: number | null; // percentage from previous stage
}

export interface SourceBreakdownItem {
  source: LeadSource;
  label: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns lead counts per stage for a funnel chart, with conversion rates
 * between adjacent stages.
 */
export function useLeadFunnelStats(startDate?: string, endDate?: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['lead-funnel', currentOrg?.id, startDate, endDate],
    queryFn: async (): Promise<FunnelStageData[]> => {
      if (!currentOrg) return [];

      let query = db
        .from('leads')
        .select('stage, created_at')
        .eq('org_id', currentOrg.id);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Count per stage
      const counts: Record<string, number> = {};
      for (const stage of LEAD_STAGES) {
        counts[stage] = 0;
      }
      for (const row of data || []) {
        const stage = row.stage as LeadStage;
        if (stage in counts) {
          counts[stage]++;
        }
      }

      // Build funnel data with conversion rates.
      // Conversion rate = count(this stage) / count(previous stage) * 100
      // For the first stage (enquiry), conversionRate is null.
      const funnel: FunnelStageData[] = LEAD_STAGES.map((stage, idx) => {
        const prevCount = idx > 0 ? counts[LEAD_STAGES[idx - 1]] : null;
        const conversionRate =
          prevCount !== null && prevCount > 0
            ? Math.round((counts[stage] / prevCount) * 100)
            : null;

        return {
          stage,
          label: STAGE_LABELS[stage],
          count: counts[stage],
          conversionRate,
        };
      });

      return funnel;
    },
    enabled: !!currentOrg,
    staleTime: STALE_REPORT,
  });
}

/**
 * Returns count of leads by source for a given date range.
 */
export function useLeadSourceBreakdown(startDate?: string, endDate?: string) {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['lead-source-breakdown', currentOrg?.id, startDate, endDate],
    queryFn: async (): Promise<SourceBreakdownItem[]> => {
      if (!currentOrg) return [];

      let query = db
        .from('leads')
        .select('source')
        .eq('org_id', currentOrg.id);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const source = row.source as LeadSource;
        counts[source] = (counts[source] || 0) + 1;
      }

      return Object.entries(counts)
        .map(([source, count]) => ({
          source: source as LeadSource,
          label: SOURCE_LABELS[source as LeadSource] || source,
          count,
        }))
        .sort((a, b) => b.count - a.count);
    },
    enabled: !!currentOrg,
    staleTime: STALE_REPORT,
  });
}

// ---------------------------------------------------------------------------
// CSV Export helper
// ---------------------------------------------------------------------------

/**
 * Export an array of leads to a CSV file and trigger a browser download.
 */
export function exportLeadsToCSV(leads: LeadListItem[], orgName: string): void {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Stage',
    'Source',
    'Instrument',
    'Children',
    'Notes',
    'Created',
  ];

  const rows = leads.map((lead) => [
    sanitiseCSVCell(lead.contact_name),
    sanitiseCSVCell(lead.contact_email || ''),
    sanitiseCSVCell(lead.contact_phone || ''),
    STAGE_LABELS[lead.stage] || lead.stage,
    SOURCE_LABELS[lead.source] || lead.source,
    sanitiseCSVCell(lead.preferred_instrument || ''),
    String(lead.student_count),
    sanitiseCSVCell(lead.notes || ''),
    new Date(lead.created_at).toLocaleDateString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${orgName.replace(/\s+/g, '_')}_leads_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
