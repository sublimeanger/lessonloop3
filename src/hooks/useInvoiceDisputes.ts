import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { logger } from "@/lib/logger";

export interface PaymentDispute {
  id: string;
  payment_id: string;
  invoice_id: string;
  org_id: string;
  stripe_dispute_id: string;
  amount_minor: number;
  currency_code: string;
  reason: string;
  status: string;
  evidence_due_by: string | null;
  stripe_dashboard_url: string | null;
  outcome: string | null;
  opened_at: string;
  closed_at: string | null;
}

export const DISPUTE_ACTIVE_STATUSES = [
  "needs_response",
  "warning_needs_response",
  "under_review",
  "warning_under_review",
] as const;

export function isDisputeActive(dispute: Pick<PaymentDispute, "status" | "outcome">): boolean {
  if (dispute.outcome) return false;
  return (DISPUTE_ACTIVE_STATUSES as readonly string[]).includes(dispute.status);
}

/**
 * Per-invoice disputes. Finance-team-gated via
 * get_disputes_for_invoice RPC.
 */
export function useInvoiceDisputes(invoiceId: string | undefined) {
  const { currentOrg } = useOrg();
  return useQuery({
    queryKey: ["invoice-disputes", invoiceId, currentOrg?.id],
    queryFn: async (): Promise<PaymentDispute[]> => {
      if (!invoiceId || !currentOrg?.id) return [];
      const { data, error } = await (supabase.rpc as any)(
        "get_disputes_for_invoice",
        { _invoice_id: invoiceId, _org_id: currentOrg.id },
      );
      if (error) {
        logger.warn("Failed to fetch disputes for invoice", error);
        return [];
      }
      return (data ?? []) as PaymentDispute[];
    },
    enabled: !!invoiceId && !!currentOrg?.id,
    staleTime: 15_000,
  });
}

/**
 * Org-wide active disputes for dashboard urgent-actions surface.
 * Ordered by evidence_due_by ASC (soonest deadline first).
 */
export function useActiveDisputesForOrg() {
  const { currentOrg } = useOrg();
  return useQuery({
    queryKey: ["active-disputes", currentOrg?.id],
    queryFn: async (): Promise<PaymentDispute[]> => {
      if (!currentOrg?.id) return [];
      const { data, error } = await (supabase.rpc as any)(
        "get_active_disputes_for_org",
        { _org_id: currentOrg.id },
      );
      if (error) {
        logger.warn("Failed to fetch active disputes", error);
        return [];
      }
      return (data ?? []) as PaymentDispute[];
    },
    enabled: !!currentOrg?.id,
    staleTime: 30_000,
  });
}
