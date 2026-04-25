import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PAUSE_THRESHOLD = 3;

async function incrementAndCheckPause(
  supabase: any,
  guardianId: string,
  orgId: string,
  reason: string,
): Promise<{ newCount: number; isPauseThreshold: boolean }> {
  const { data: prefs } = await supabase
    .from("guardian_payment_preferences")
    .select("consecutive_failure_count")
    .eq("guardian_id", guardianId)
    .eq("org_id", orgId)
    .single();

  const newCount = (prefs?.consecutive_failure_count ?? 0) + 1;
  const isPauseThreshold = newCount >= PAUSE_THRESHOLD;

  const update: Record<string, any> = { consecutive_failure_count: newCount };
  if (isPauseThreshold) {
    update.auto_pay_paused_at = new Date().toISOString();
    update.auto_pay_paused_reason = `Auto-paused after ${PAUSE_THRESHOLD} consecutive failures (last reason: ${reason})`;
  }

  const { error: updateErr } = await supabase
    .from("guardian_payment_preferences")
    .update(update)
    .eq("guardian_id", guardianId)
    .eq("org_id", orgId);

  if (updateErr) {
    console.error("Failed to increment failure count:", updateErr);
  }

  if (isPauseThreshold) {
    try {
      await supabase.from("audit_log").insert({
        org_id: orgId,
        actor_user_id: null,
        action: "auto_pay_paused",
        entity_type: "guardian",
        entity_id: guardianId,
        after: { reason: update.auto_pay_paused_reason, threshold: PAUSE_THRESHOLD },
      });
    } catch (auditErr) {
      console.error("Failed to write auto_pay_paused audit:", auditErr);
    }
  }

  return { newCount, isPauseThreshold };
}

async function invokeFailureNotification(
  supabase: any,
  payload: Record<string, unknown>,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-auto-pay-failure-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to invoke send-auto-pay-failure-notification:", err);
  }
}

/**
 * Auto-pay cron function.
 * Finds installments due today (or overdue) where the guardian has auto-pay enabled,
 * and creates off-session PaymentIntents to charge their default card.
 *
 * Intended to be called daily via pg_cron or a Supabase scheduled invocation.
 */
serve(async (req) => {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authorized (service role or cron secret)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.includes(supabaseServiceKey)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Find all due/overdue installments with auto-pay enabled. Includes
    // partially_paid installments whose outstanding amount still needs to be
    // collected (see A3 fix in migration 20260417190000).
    const { data: installments, error: queryError } = await supabase
      .from("invoice_installments")
      .select(`
        id,
        invoice_id,
        amount_minor,
        installment_number,
        due_date,
        invoices!inner (
          id,
          org_id,
          payer_guardian_id,
          invoice_number,
          currency_code,
          status
        )
      `)
      .in("status", ["pending", "overdue", "partially_paid"])
      .lte("due_date", today);

    if (queryError) {
      console.error("Failed to query installments:", queryError);
      throw new Error(`Query failed: ${queryError.message}`);
    }

    if (!installments || installments.length === 0) {
      return new Response(JSON.stringify({ message: "No installments due", processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;
    const results: Array<{ installmentId: string; status: string; error?: string }> = [];

    for (const inst of installments) {
      const invoice = (inst as any).invoices;
      if (!invoice || !invoice.payer_guardian_id) continue;
      if (!["sent", "overdue"].includes(invoice.status)) continue;

      // Check if guardian has auto-pay enabled
      const { data: prefs } = await supabase
        .from("guardian_payment_preferences")
        .select(
          "stripe_customer_id, default_payment_method_id, auto_pay_enabled, auto_pay_paused_at",
        )
        .eq("guardian_id", invoice.payer_guardian_id)
        .eq("org_id", invoice.org_id)
        .maybeSingle();

      if (!prefs?.auto_pay_enabled || !prefs.stripe_customer_id || !prefs.default_payment_method_id) {
        continue;
      }

      // Compute outstanding on this installment (amount_minor minus
      // non-refunded prior payments). Covers pending (outstanding = amount),
      // partially_paid (outstanding = amount − prior), and the dedup case
      // (outstanding = 0 if already fully paid but status lagged).
      const { data: priorPayments } = await supabase
        .from("payments")
        .select("id, amount_minor")
        .eq("installment_id", inst.id);

      const priorPaymentIds = (priorPayments || []).map((p: any) => p.id);
      let priorRefunded = 0;
      if (priorPaymentIds.length > 0) {
        const { data: priorRefundRows } = await supabase
          .from("refunds")
          .select("amount_minor")
          .in("payment_id", priorPaymentIds)
          .eq("status", "succeeded");
        priorRefunded = (priorRefundRows || []).reduce((s: number, r: any) => s + r.amount_minor, 0);
      }
      const priorApplied = (priorPayments || []).reduce((s: number, p: any) => s + p.amount_minor, 0) - priorRefunded;
      const outstanding = inst.amount_minor - priorApplied;

      if (outstanding <= 0) continue;

      // Skip paused guardians. Log the skip so operators can see how many
      // were suppressed today (visibility into the pause-state surface).
      // Don't log skips for not-enabled / no-pm — those aren't failures.
      if (prefs.auto_pay_paused_at) {
        await supabase.from("auto_pay_attempts").insert({
          org_id: invoice.org_id,
          invoice_id: invoice.id,
          installment_id: inst.id,
          guardian_id: invoice.payer_guardian_id,
          amount_minor: outstanding,
          outcome: "skipped_paused",
        }).then(() => {}, (err: any) => console.error("Skip-paused log failed:", err));
        continue;
      }

      // Get org details for Connect routing
      const { data: org } = await supabase
        .from("organisations")
        .select("stripe_connect_account_id, platform_fee_percent")
        .eq("id", invoice.org_id)
        .single();

      try {
        const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
          amount: outstanding,
          currency: (invoice.currency_code || "gbp").toLowerCase(),
          customer: prefs.stripe_customer_id,
          payment_method: prefs.default_payment_method_id,
          off_session: true,
          confirm: true,
          metadata: {
            lessonloop_invoice_id: inst.invoice_id,
            lessonloop_installment_id: inst.id,
            lessonloop_org_id: invoice.org_id,
            lessonloop_auto_pay: "true",
          },
        };

        // Stripe Connect routing
        const stripeOpts: Stripe.RequestOptions = {
          // Idempotency: guard against duplicate PIs if the webhook lags and
          // the cron re-triggers before payments.installment_id lands.
          idempotencyKey: `auto-pay-${inst.id}-${outstanding}`,
        };
        if (org?.stripe_connect_account_id) {
          paymentIntentParams.transfer_data = {
            destination: org.stripe_connect_account_id,
          };
          if (org.platform_fee_percent && org.platform_fee_percent > 0) {
            paymentIntentParams.application_fee_amount = Math.round(
              outstanding * (org.platform_fee_percent / 100)
            );
          }
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, stripeOpts);

        // J6-F15: Local audit trail independent of webhook delivery.
        // Best-effort — failure here never aborts the auto-pay pass.
        try {
          await supabase.from("audit_log").insert({
            org_id: invoice.org_id,
            actor_user_id: null,
            action: "auto_pay_initiated",
            entity_type: "invoice",
            entity_id: inst.invoice_id,
            after: {
              installment_id: inst.id,
              installment_number: inst.installment_number,
              outstanding_minor: outstanding,
              payment_intent_id: paymentIntent.id,
              stripe_status: paymentIntent.status,
            },
          });
        } catch (auditErr) {
          console.error("Failed to write auto_pay_initiated audit:", auditErr);
        }

        if (paymentIntent.status === "succeeded") {
          // Log the successful attempt for observability + dedup history.
          await supabase.from("auto_pay_attempts").insert({
            org_id: invoice.org_id,
            invoice_id: invoice.id,
            installment_id: inst.id,
            guardian_id: invoice.payer_guardian_id,
            amount_minor: outstanding,
            outcome: "succeeded",
            stripe_payment_intent_id: paymentIntent.id,
            stripe_status: paymentIntent.status,
          }).then(() => {}, (e: any) => console.error("Success attempt log failed:", e));

          // Reset the consecutive_failure_count on success. Use .gt to avoid
          // an unnecessary write when count is already 0. Note: we deliberately
          // do NOT clear auto_pay_paused_at here — pause survives a manual
          // payment in the portal; the parent must explicitly re-enable.
          await supabase
            .from("guardian_payment_preferences")
            .update({ consecutive_failure_count: 0 })
            .eq("guardian_id", invoice.payer_guardian_id)
            .eq("org_id", invoice.org_id)
            .gt("consecutive_failure_count", 0)
            .then(() => {}, (e: any) => console.error("Counter reset failed:", e));

          // The webhook will record the payment row.
          results.push({ installmentId: inst.id, status: "succeeded" });
          processed++;
        } else {
          // Treat any non-succeeded PI status (notably requires_action) as a
          // failure: log the attempt, increment counter, invoke notification.
          results.push({ installmentId: inst.id, status: paymentIntent.status });
          if (paymentIntent.status === "requires_action") {
            console.log(`Installment ${inst.id} requires authentication, skipping auto-pay`);
          }

          const { data: attemptRow } = await supabase
            .from("auto_pay_attempts")
            .insert({
              org_id: invoice.org_id,
              invoice_id: invoice.id,
              installment_id: inst.id,
              guardian_id: invoice.payer_guardian_id,
              amount_minor: outstanding,
              outcome: paymentIntent.status === "requires_action" ? "requires_action" : "failed",
              stripe_payment_intent_id: paymentIntent.id,
              stripe_status: paymentIntent.status,
            })
            .select("id")
            .single();

          const { newCount, isPauseThreshold } = await incrementAndCheckPause(
            supabase,
            invoice.payer_guardian_id,
            invoice.org_id,
            paymentIntent.status ?? "unknown",
          );

          if (attemptRow?.id) {
            await invokeFailureNotification(supabase, {
              attempt_id: attemptRow.id,
              org_id: invoice.org_id,
              invoice_id: invoice.id,
              installment_id: inst.id,
              guardian_id: invoice.payer_guardian_id,
              amount_minor: outstanding,
              currency_code: invoice.currency_code,
              error_code: null,
              error_type: null,
              stripe_status: paymentIntent.status,
              invoice_number: invoice.invoice_number,
              is_pause_threshold: isPauseThreshold,
              consecutive_failure_count: newCount,
            });
          }
          failed++;
        }
      } catch (err: any) {
        console.error(`Auto-pay failed for installment ${inst.id}:`, err.message);
        results.push({ installmentId: inst.id, status: "failed", error: err.message });
        failed++;

        const { data: attemptRow } = await supabase
          .from("auto_pay_attempts")
          .insert({
            org_id: invoice.org_id,
            invoice_id: invoice.id,
            installment_id: inst.id,
            guardian_id: invoice.payer_guardian_id,
            amount_minor: outstanding,
            outcome: "failed",
            stripe_payment_intent_id: err.raw?.payment_intent?.id ?? null,
            stripe_status: err.raw?.payment_intent?.status ?? null,
            stripe_error_code: err.code ?? null,
            stripe_error_type: err.type ?? null,
            stripe_error_message: err.message ?? String(err),
          })
          .select("id")
          .single();

        // J6-F15: Local audit trail for the failure path. Webhook never
        // fires on a failed create — this is the only signal operators
        // get that auto-pay was attempted and rejected.
        try {
          await supabase.from("audit_log").insert({
            org_id: invoice.org_id,
            actor_user_id: null,
            action: "auto_pay_failed",
            entity_type: "invoice",
            entity_id: inst.invoice_id,
            after: {
              installment_id: inst.id,
              installment_number: inst.installment_number,
              outstanding_minor: outstanding,
              error: err.message ?? String(err),
              code: err.code ?? null,
              type: err.type ?? null,
            },
          });
        } catch (auditErr) {
          console.error("Failed to write auto_pay_failed audit:", auditErr);
        }

        const { newCount, isPauseThreshold } = await incrementAndCheckPause(
          supabase,
          invoice.payer_guardian_id,
          invoice.org_id,
          err.code ?? err.type ?? "unknown",
        );

        if (attemptRow?.id) {
          await invokeFailureNotification(supabase, {
            attempt_id: attemptRow.id,
            org_id: invoice.org_id,
            invoice_id: invoice.id,
            installment_id: inst.id,
            guardian_id: invoice.payer_guardian_id,
            amount_minor: outstanding,
            currency_code: invoice.currency_code,
            error_code: err.code ?? null,
            error_type: err.type ?? null,
            stripe_status: err.raw?.payment_intent?.status ?? null,
            invoice_number: invoice.invoice_number,
            is_pause_threshold: isPauseThreshold,
            consecutive_failure_count: newCount,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "Auto-pay complete", processed, failed, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in stripe-auto-pay-installment:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
