import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronAuth } from "../_shared/cron-auth.ts";

interface TemplateDue {
  id: string;
  org_id: string;
  name: string;
  auto_send: boolean;
}

interface GeneratorResult {
  run_id: string;
  outcome: "completed" | "partial" | "failed" | string;
  invoice_count: number;
  recipients_skipped: number;
  recipients_total: number;
  invoice_ids: string[];
  period_start: string;
  period_end: string;
}

interface RunErrorRow {
  student_id: string | null;
  error_code: string;
  error_message: string;
}

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  const summary = {
    templates_due: 0,
    templates_processed: 0,
    templates_rpc_failed: 0,
    invoices_generated: 0,
    invoices_sent: 0,
    sends_failed: 0,
    alerts_triggered: 0,
    errors: [] as string[],
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Find due templates ───────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];  // YYYY-MM-DD
    const { data: dueTemplates, error: fetchError } = await supabase
      .from("recurring_invoice_templates")
      .select("id, org_id, name, auto_send")
      .eq("active", true)
      .lte("next_run_date", today);

    if (fetchError) {
      throw new Error(`Failed to fetch due templates: ${fetchError.message}`);
    }

    const templates = (dueTemplates || []) as TemplateDue[];
    summary.templates_due = templates.length;

    if (templates.length === 0) {
      console.log("No due recurring templates today");
      return new Response(
        JSON.stringify({ success: true, ...summary }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${templates.length} due recurring template(s)`);

    // ── 2. Process each template ────────────────────────────────────
    for (const template of templates) {
      try {
        // ── 2a. Invoke generator RPC ─────────────────────────────────
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "generate_invoices_from_template",
          {
            _template_id: template.id,
            _triggered_by: "scheduler",
            _source: "recurring_scheduler",
          },
        );

        if (rpcError) {
          summary.templates_rpc_failed++;
          summary.errors.push(
            `Template ${template.id} (${template.name}): RPC failed — ${rpcError.message}`,
          );
          console.error(`Template ${template.id} RPC failed:`, rpcError);
          continue;
        }

        const result = rpcData as GeneratorResult;
        summary.templates_processed++;
        summary.invoices_generated += result.invoice_count;

        // ── 2b. Auto-send draft invoices (if auto_send enabled) ──────
        if (
          template.auto_send &&
          result.outcome !== "failed" &&
          result.invoice_ids.length > 0
        ) {
          // Filter to draft invoices only — idempotency guard per Phase 3 design.
          const { data: draftInvoices } = await supabase
            .from("invoices")
            .select("id")
            .in("id", result.invoice_ids)
            .eq("status", "draft");

          const draftIds = (draftInvoices || []).map((i: any) => i.id);

          for (const invoiceId of draftIds) {
            // Pre-warm the PDF cache so the email-attach step inside
            // send-invoice-email-internal hits a warm cache instead of
            // regenerating. Best-effort: failure here is logged but
            // doesn't block the email send (the email-side fallback
            // emits its own platform_audit_log row if PDF gen fails).
            try {
              const warmResp = await fetch(
                `${supabaseUrl}/functions/v1/generate-invoice-pdf`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({ invoice_id: invoiceId }),
                },
              );
              if (!warmResp.ok) {
                console.warn(
                  `[recurring-billing-scheduler] PDF cache warm failed for invoice ${invoiceId}: ${warmResp.status}`,
                );
              }
            } catch (warmErr) {
              console.warn(
                `[recurring-billing-scheduler] PDF cache warm threw for invoice ${invoiceId}: ${warmErr}`,
              );
            }

            try {
              const sendRes = await fetch(
                `${supabaseUrl}/functions/v1/send-invoice-email-internal`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    invoice_id: invoiceId,
                    source: "recurring_scheduler",
                    is_reminder: false,
                  }),
                },
              );

              if (sendRes.ok) {
                summary.invoices_sent++;
              } else {
                summary.sends_failed++;
                const errText = await sendRes.text();
                summary.errors.push(
                  `Template ${template.id} send failed for invoice ${invoiceId}: ${sendRes.status} ${errText}`,
                );
              }
            } catch (sendErr: unknown) {
              summary.sends_failed++;
              const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
              summary.errors.push(
                `Template ${template.id} send threw for invoice ${invoiceId}: ${msg}`,
              );
            }
          }
        }

        // ── 2c. Alert on partial/failed runs ─────────────────────────
        if (result.outcome === "partial" || result.outcome === "failed") {
          try {
            // Fetch up to 10 error samples for the alert body.
            const { data: errorRows } = await supabase
              .from("recurring_template_run_errors")
              .select("student_id, error_code, error_message")
              .eq("run_id", result.run_id)
              .limit(10);

            const alertRes = await fetch(
              `${supabaseUrl}/functions/v1/send-recurring-billing-alert`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  template_id: template.id,
                  run_id: result.run_id,
                  org_id: template.org_id,
                  outcome: result.outcome,
                  invoice_count: result.invoice_count,
                  recipients_skipped: result.recipients_skipped,
                  recipients_total: result.recipients_total,
                  period_start: result.period_start,
                  period_end: result.period_end,
                  template_name: template.name,
                  error_samples: (errorRows || []) as RunErrorRow[],
                }),
              },
            );

            if (alertRes.ok) {
              summary.alerts_triggered++;
            } else {
              const errText = await alertRes.text();
              summary.errors.push(
                `Template ${template.id} alert failed: ${alertRes.status} ${errText}`,
              );
            }
          } catch (alertErr: unknown) {
            const msg = alertErr instanceof Error ? alertErr.message : String(alertErr);
            summary.errors.push(`Template ${template.id} alert threw: ${msg}`);
          }
        }
      } catch (tplErr: unknown) {
        // Outer per-template catch — shouldn't usually fire (RPC errors
        // handled above), but protects against unexpected throws
        // (e.g. supabase client init issues).
        summary.templates_rpc_failed++;
        const msg = tplErr instanceof Error ? tplErr.message : String(tplErr);
        summary.errors.push(`Template ${template.id} unexpected throw: ${msg}`);
        console.error(`Template ${template.id} unexpected error:`, tplErr);
      }
    }

    console.log(
      `Scheduler complete. Due: ${summary.templates_due}, ` +
      `Processed: ${summary.templates_processed}, RPC-failed: ${summary.templates_rpc_failed}, ` +
      `Invoices: ${summary.invoices_generated}, Sent: ${summary.invoices_sent}, ` +
      `Send-failed: ${summary.sends_failed}, Alerts: ${summary.alerts_triggered}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        ...summary,
        errors: summary.errors.length > 0 ? summary.errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Scheduler fatal error:", msg);
    return new Response(
      JSON.stringify({
        success: false,
        error: msg,
        ...summary,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
