import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { logger } from "@/lib/logger";

/**
 * Returns a Set of invoice IDs with an active dispute, for the
 * current org. Used by the invoice list to render a dispute flag
 * without bloating the main invoice query. Cheap — single SELECT
 * filtered on a partial index (idx_payment_disputes_active).
 */
export function useInvoiceIdsWithActiveDispute() {
  const { currentOrg } = useOrg();
  return useQuery({
    queryKey: ["invoices-with-active-dispute", currentOrg?.id],
    queryFn: async (): Promise<Set<string>> => {
      if (!currentOrg?.id) return new Set();
      const { data, error } = await supabase
        .from("payment_disputes")
        .select("invoice_id")
        .eq("org_id", currentOrg.id)
        .in("status", [
          "needs_response",
          "warning_needs_response",
          "under_review",
          "warning_under_review",
        ]);
      if (error) {
        logger.warn("Failed to fetch active-dispute invoice IDs", error);
        return new Set();
      }
      return new Set((data ?? []).map((r: any) => r.invoice_id));
    },
    enabled: !!currentOrg?.id,
    staleTime: 30_000,
  });
}
