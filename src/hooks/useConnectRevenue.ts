import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { STALE_REPORT } from '@/config/query-stale-times';

export interface BalanceAmount {
  amount: number;
  currency: string;
}

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrival_date: number;
  created: number;
}

export interface BalanceTransaction {
  id: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  type: string;
  description: string | null;
  created: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalFees: number;
  totalNet: number;
  totalRefunds: number;
  transactionCount: number;
}

export interface ConnectRevenueData {
  balance: {
    available: BalanceAmount[];
    pending: BalanceAmount[];
  };
  payouts: Payout[];
  transactions: BalanceTransaction[];
  summary: RevenueSummary;
}

export function useConnectRevenue(
  orgId: string | undefined,
  dateRange: { start: string; end: string }
) {
  return useQuery({
    queryKey: ['connect-revenue', orgId, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-revenue', {
        body: { orgId, startDate: dateRange.start, endDate: dateRange.end },
      });

      if (error) throw error;
      return data as ConnectRevenueData;
    },
    enabled: !!orgId,
    staleTime: STALE_REPORT,
  });
}
