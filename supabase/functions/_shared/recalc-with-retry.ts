/**
 * Wraps recalculate_invoice_paid with retry and audit-trail on final
 * failure. Designed for post-refund / post-payment call sites where
 * money has already moved through Stripe — silently swallowing a
 * recalc error leaves invoices.paid_minor stale and breaks the I1
 * ledger identity invariant.
 *
 * Contract:
 * - Retries up to 2 additional times (3 total attempts) with 500ms
 *   linear backoff on each failure.
 * - On final failure, writes an audit_log row with
 *   action='invoice_recalc_failed' and returns { ok: false, error }.
 *   The caller is expected to continue and return success to the
 *   client with a warning flag — the refund itself has succeeded;
 *   only the ledger view is stale.
 * - On success at any attempt, returns { ok: true, attempts }.
 *
 * Called from: stripe-process-refund, stripe-webhook (charge.refunded),
 * and potentially other post-payment/post-refund sites.
 *
 * Safety: this is the LAST line of defence before silent data
 * divergence. Do not replace with best-effort behaviour.
 */

export interface RecalcResult {
  ok: boolean;
  attempts: number;
  error?: string;
}

export interface RecalcContext {
  /** Supabase service-role client. */
  // deno-lint-ignore no-explicit-any
  supabase: any;
  invoiceId: string;
  orgId: string;
  /** What triggered the recalc — for audit log context. */
  source: 'stripe_refund_admin' | 'stripe_refund_webhook' | 'manual_retry' | string;
  /** Optional caller user ID for audit log. NULL for webhook path. */
  actorUserId?: string | null;
  /** Optional extra jsonb fields for the audit log entry. */
  extra?: Record<string, unknown>;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function recalcWithRetry(ctx: RecalcContext): Promise<RecalcResult> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { error } = await ctx.supabase.rpc('recalculate_invoice_paid', {
      _invoice_id: ctx.invoiceId,
    });

    if (!error) {
      return { ok: true, attempts: attempt };
    }

    lastError = error;
    console.error(
      `[recalc-with-retry] attempt ${attempt}/${MAX_ATTEMPTS} failed for invoice ${ctx.invoiceId}:`,
      error.message ?? error,
    );

    if (attempt < MAX_ATTEMPTS) {
      await sleep(BACKOFF_MS * attempt);
    }
  }

  // Final failure — write audit_log so the invoice detail banner can
  // surface it and the operator can trigger a manual recalc. Never
  // throws — if the audit write itself fails we log and return; the
  // caller still needs to know recalc failed.
  const errorMsg =
    lastError && typeof lastError === 'object' && 'message' in lastError
      ? String((lastError as { message: unknown }).message)
      : String(lastError);

  try {
    await ctx.supabase.from('audit_log').insert({
      org_id: ctx.orgId,
      actor_user_id: ctx.actorUserId ?? null,
      action: 'invoice_recalc_failed',
      entity_type: 'invoice',
      entity_id: ctx.invoiceId,
      after: {
        source: ctx.source,
        attempts: MAX_ATTEMPTS,
        error: errorMsg,
        ...(ctx.extra ?? {}),
      },
    });
  } catch (auditErr) {
    console.error('[recalc-with-retry] failed to write audit_log:', auditErr);
  }

  return { ok: false, attempts: MAX_ATTEMPTS, error: errorMsg };
}
