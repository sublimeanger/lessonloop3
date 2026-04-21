/**
 * Payment-type classification helpers. Single source of truth for
 * deciding whether a payment came through Stripe (refundable via
 * stripe-process-refund edge function) or was recorded manually
 * (refundable via record_manual_refund RPC).
 *
 * A "Stripe payment" is one where BOTH provider='stripe' AND
 * provider_reference is non-empty — the reference is the Stripe
 * payment_intent ID required to issue the refund via the Stripe
 * API. Missing either means we can only record a manual refund
 * (ledger-only, no money movement back through Stripe).
 */
export interface PaymentLike {
  provider?: string | null;
  provider_reference?: string | null;
}

export function isStripePayment(payment: PaymentLike | null | undefined): boolean {
  return !!(payment && payment.provider === 'stripe' && payment.provider_reference);
}

export function isManualPayment(payment: PaymentLike | null | undefined): boolean {
  return !isStripePayment(payment);
}

/**
 * Pick the first payment on an invoice that still has a refundable
 * balance (amount_minor - sum of succeeded refunds > 0). Returns
 * null if nothing is refundable. Used by Refund header button,
 * list-view Refund action, and the void-confirm "Record Refund
 * First" branch to seed the RefundDialog.
 */
export interface PaymentWithId extends PaymentLike {
  id: string;
  amount_minor: number;
}

export interface RefundLike {
  payment_id?: string | null;
  original_payment_id?: string | null;
  amount_minor?: number | null;
  refund_amount_minor?: number | null;
  status?: string | null;
}

export function refundedForPayment(
  paymentId: string,
  refunds: RefundLike[] | null | undefined,
): number {
  if (!refunds) return 0;
  return refunds
    .filter((r) => {
      // Only count succeeded refunds; pending/failed don't reduce
      // refundable balance. Schema uses payment_id; tolerate legacy
      // original_payment_id referenced in pre-audit code paths.
      const pid = r.payment_id ?? r.original_payment_id;
      if (pid !== paymentId) return false;
      if (r.status && r.status !== 'succeeded') return false;
      return true;
    })
    .reduce((sum, r) => sum + (r.amount_minor ?? r.refund_amount_minor ?? 0), 0);
}

export function getFirstRefundablePayment<T extends PaymentWithId>(
  payments: T[] | null | undefined,
  refunds: RefundLike[] | null | undefined,
): { payment: T; alreadyRefunded: number } | null {
  if (!payments) return null;
  for (const p of payments) {
    const alreadyRefunded = refundedForPayment(p.id, refunds);
    if (alreadyRefunded < p.amount_minor) {
      return { payment: p, alreadyRefunded };
    }
  }
  return null;
}

export function hasRefundablePayment(
  payments: PaymentWithId[] | null | undefined,
  refunds: RefundLike[] | null | undefined,
): boolean {
  return getFirstRefundablePayment(payments, refunds) !== null;
}
