// Canonical helpers for "amount due to charge Stripe" math, shared by
// stripe-create-payment-intent (embedded PaymentDrawer flow) and
// stripe-create-checkout (redirect-to-Stripe-Checkout flow).
//
// Refund-netting: invoice.paid_minor is canonical-net-of-refunds
// (maintained by recalculate_invoice_paid RPC, called from every
// payment-recording and refund-recording RPC). All "amount due"
// calculations must read paid_minor, never sum payments directly.
//
// Closes CC-8 (refund netting drift). Replaces the per-fn drift
// between stripe-create-payment-intent and stripe-create-checkout.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AmountDueInvoiceShape {
  id: string;
  total_minor: number;
  paid_minor: number | null;
  payment_plan_enabled: boolean | null;
  installment_count: number | null;
}

/**
 * Top-level amount due on a whole invoice, refund-netted.
 * Use this for the simple-invoice (no payment plan) charge path.
 */
export function invoiceAmountDue(invoice: AmountDueInvoiceShape): number {
  return invoice.total_minor - (invoice.paid_minor ?? 0);
}

/**
 * Outstanding on a single installment, refund-netted.
 * Computes (installment.amount_minor) minus (sum of payments attached
 * to this installment) plus (sum of refunds against those payments).
 *
 * Mirrors the inline helper that has lived inside
 * stripe-create-payment-intent.installmentOutstanding since Jan 2026.
 *
 * Returns 0 if the installment has been fully paid (or over-paid;
 * over-payment is impossible by trigger guard but the Math.max is
 * defensive against drift).
 */
export async function installmentOutstanding(
  supabase: SupabaseClient,
  installmentId: string,
  amountMinor: number,
): Promise<number> {
  const { data: priorPayments } = await supabase
    .from("payments")
    .select("id, amount_minor")
    .eq("installment_id", installmentId);

  const priorIds = (priorPayments ?? []).map((p: { id: string }) => p.id);

  let priorRefunded = 0;
  if (priorIds.length > 0) {
    const { data: priorRefundRows } = await supabase
      .from("refunds")
      .select("amount_minor")
      .in("payment_id", priorIds)
      .eq("status", "succeeded");
    priorRefunded = (priorRefundRows ?? []).reduce(
      (s: number, r: { amount_minor: number }) => s + r.amount_minor,
      0,
    );
  }

  const priorPaid = (priorPayments ?? []).reduce(
    (s: number, p: { amount_minor: number }) => s + p.amount_minor,
    0,
  );
  const priorApplied = priorPaid - priorRefunded;

  return Math.max(0, amountMinor - priorApplied);
}

/** Canonical pending-installment status filter. Matches the set used
 *  by stripe-create-payment-intent since the partially_paid status
 *  was introduced. The legacy ["pending", "overdue"] filter is wrong:
 *  it skips partially_paid installments and rejects payment on them. */
export const PENDING_INSTALLMENT_STATUSES = ["pending", "overdue", "partially_paid"] as const;
