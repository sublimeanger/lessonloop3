import { useQuery } from '@tanstack/react-query';
import { STALE_REPORT, GC_REPORT } from '@/config/query-stale-times';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { format, subMonths, startOfMonth, differenceInDays, parseISO } from 'date-fns';

export interface PaymentAnalytics {
  totalCollectedMinor: number;
  outstandingMinor: number;
  collectionRate: number; // 0-100 percentage
  avgDaysToPayment: number;
  monthlyTrend: MonthlyPayment[];
  methodBreakdown: PaymentMethodBreakdown[];
}

export interface MonthlyPayment {
  month: string; // YYYY-MM
  monthLabel: string; // e.g. "Jan 26"
  amountMinor: number;
  count: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  label: string;
  amountMinor: number;
  count: number;
  percentage: number;
}

const emptyAnalytics: PaymentAnalytics = {
  totalCollectedMinor: 0,
  outstandingMinor: 0,
  collectionRate: 0,
  avgDaysToPayment: 0,
  monthlyTrend: [],
  methodBreakdown: [],
};

export function usePaymentAnalytics() {
  const { currentOrg } = useOrg();
  const orgId = currentOrg?.id;

  return useQuery<PaymentAnalytics>({
    queryKey: ['payment-analytics', orgId],
    queryFn: async (): Promise<PaymentAnalytics> => {
      if (!orgId) return emptyAnalytics;

      // Run queries in parallel
      const now = new Date();
      const twelveMonthsAgo = startOfMonth(subMonths(now, 11));
      const twelveMonthsAgoStr = format(twelveMonthsAgo, 'yyyy-MM-dd');

      const [paymentsRes, invoicesRes, outstandingRes] = await Promise.all([
        // All payments in last 12 months
        supabase
          .from('payments')
          .select('id, amount_minor, method, paid_at, invoice_id')
          .eq('org_id', orgId)
          .gte('paid_at', twelveMonthsAgoStr)
          .order('paid_at', { ascending: true })
          .limit(5000),

        // All sent/paid invoices for collection rate + avg days calculation
        supabase
          .from('invoices')
          .select('id, status, total_minor, paid_minor, issue_date, due_date')
          .eq('org_id', orgId)
          .in('status', ['sent', 'overdue', 'paid'])
          .gte('created_at', twelveMonthsAgoStr)
          .limit(5000),

        // Outstanding amount
        supabase
          .from('invoices')
          .select('total_minor, paid_minor')
          .eq('org_id', orgId)
          .in('status', ['sent', 'overdue']),
      ]);

      const payments = paymentsRes.data || [];
      const invoices = invoicesRes.data || [];
      const outstandingInvoices = outstandingRes.data || [];

      // Total collected (12 months)
      const totalCollectedMinor = payments.reduce((sum, p) => sum + (p.amount_minor || 0), 0);

      // Outstanding balance
      const outstandingMinor = outstandingInvoices.reduce(
        (sum, inv) => sum + ((inv.total_minor || 0) - (inv.paid_minor || 0)),
        0
      );

      // Collection rate: paid invoices / total sent+paid invoices
      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter((inv) => inv.status === 'paid').length;
      const collectionRate = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0;

      // Average days to payment
      const paidWithDates = invoices.filter(
        (inv: any) => inv.status === 'paid' && inv.issue_date
      );
      let avgDaysToPayment = 0;
      if (paidWithDates.length > 0) {
        // Find matching payment for each paid invoice
        const invoicePayments = new Map<string, string>();
        for (const p of payments) {
          if (p.invoice_id && p.paid_at && !invoicePayments.has(p.invoice_id)) {
            invoicePayments.set(p.invoice_id, p.paid_at);
          }
        }

        let totalDays = 0;
        let counted = 0;
        for (const inv of paidWithDates) {
          const paidAt = invoicePayments.get((inv as any).id);
          if (paidAt && (inv as any).issue_date) {
            const days = differenceInDays(parseISO(paidAt), parseISO((inv as any).issue_date));
            if (days >= 0) {
              totalDays += days;
              counted++;
            }
          }
        }
        avgDaysToPayment = counted > 0 ? Math.round(totalDays / counted) : 0;
      }

      // Monthly trend (last 12 months)
      const monthlyMap = new Map<string, { amountMinor: number; count: number }>();
      for (let i = 0; i < 12; i++) {
        const monthDate = subMonths(now, 11 - i);
        const key = format(startOfMonth(monthDate), 'yyyy-MM');
        monthlyMap.set(key, { amountMinor: 0, count: 0 });
      }

      for (const p of payments) {
        if (!p.paid_at) continue;
        const key = format(parseISO(p.paid_at), 'yyyy-MM');
        const existing = monthlyMap.get(key);
        if (existing) {
          existing.amountMinor += p.amount_minor || 0;
          existing.count++;
        }
      }

      const monthlyTrend: MonthlyPayment[] = Array.from(monthlyMap.entries()).map(
        ([month, data]) => ({
          month,
          monthLabel: format(parseISO(`${month}-01`), 'MMM yy'),
          amountMinor: data.amountMinor,
          count: data.count,
        })
      );

      // Payment method breakdown
      const methodMap = new Map<string, { amountMinor: number; count: number }>();
      for (const p of payments) {
        const method = p.method || 'other';
        const existing = methodMap.get(method) || { amountMinor: 0, count: 0 };
        existing.amountMinor += p.amount_minor || 0;
        existing.count++;
        methodMap.set(method, existing);
      }

      const methodLabels: Record<string, string> = {
        card: 'Card',
        cash: 'Cash',
        bacs_debit: 'Bank Transfer',
        bank_transfer: 'Bank Transfer',
        manual: 'Manual',
        stripe: 'Stripe',
        other: 'Other',
      };

      const methodBreakdown: PaymentMethodBreakdown[] = Array.from(methodMap.entries())
        .map(([method, data]) => ({
          method,
          label: methodLabels[method] || method,
          amountMinor: data.amountMinor,
          count: data.count,
          percentage: totalCollectedMinor > 0
            ? Math.round((data.amountMinor / totalCollectedMinor) * 100)
            : 0,
        }))
        .sort((a, b) => b.amountMinor - a.amountMinor);

      return {
        totalCollectedMinor,
        outstandingMinor,
        collectionRate,
        avgDaysToPayment,
        monthlyTrend,
        methodBreakdown,
      };
    },
    enabled: !!orgId,
    staleTime: STALE_REPORT,
    gcTime: GC_REPORT,
  });
}
