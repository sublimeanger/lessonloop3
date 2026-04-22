import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronAuth } from "../_shared/cron-auth.ts";

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date().toISOString().split("T")[0];

  // 1. Mark pending installments past due_date as overdue (only for
  //    non-void/paid invoices). partially_paid installments stay as-is —
  //    the A3 design keeps partially_paid distinct from overdue so the
  //    "has money attributed" information isn't lost. They still count
  //    toward the parent-invoice recalc below (J6-F6).
  const { data: eligibleInstallments } = await supabase
    .from("invoice_installments")
    .select("id, invoice:invoices!inner(status)")
    .eq("status", "pending")
    .lt("due_date", today)
    .not("invoice.status", "in", "(void,paid)");

  const eligibleIds = (eligibleInstallments || []).map((i: any) => i.id);

  let overdueInstallments: { invoice_id: string }[] | null = null;
  let updateError: any = null;

  if (eligibleIds.length > 0) {
    const result = await supabase
      .from("invoice_installments")
      .update({ status: "overdue" })
      .in("id", eligibleIds)
      .select("invoice_id");
    overdueInstallments = result.data;
    updateError = result.error;
  }

  if (updateError) {
    console.error("Failed to mark overdue installments:", updateError);
    return new Response(JSON.stringify({ success: false, error: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Sent→overdue flip for invoices whose installments just flipped.
  //    This is the canonical path for time-based sent→overdue — the generic
  //    recalculate_invoice_paid helper only covers refund-reopen (paid→overdue)
  //    via its A4 branch, not time-based sent→overdue. Kept here as the
  //    cron-only concern (J6-F10, Option 1).
  const flippedInvoiceIds = [...new Set(
    (overdueInstallments || []).map((i: { invoice_id: string }) => i.invoice_id)
  )];

  let invoicesUpdated = 0;
  if (flippedInvoiceIds.length > 0) {
    const { data: updated, error: invoiceError } = await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .in("id", flippedInvoiceIds)
      .in("status", ["draft", "sent"])
      .select("id");

    if (invoiceError) {
      console.error("Failed to update invoice statuses:", invoiceError);
    } else {
      invoicesUpdated = updated?.length || 0;
    }
  }

  // 3. Collect invoices with any partially_paid installment whose due_date
  //    is past — their parent invoice status stays as-is, but we want the
  //    recalc pass below to pick up any refund drift (installment statuses
  //    that need re-derivation) so dashboards reflect current reality (J6-F6).
  const { data: partialPastDue } = await supabase
    .from("invoice_installments")
    .select("invoice_id, invoice:invoices!inner(status)")
    .eq("status", "partially_paid")
    .lt("due_date", today)
    .not("invoice.status", "in", "(void,paid)");

  const partialInvoiceIds = [...new Set(
    (partialPastDue || []).map((i: any) => i.invoice_id as string)
  )];

  // 4. Merge affected-invoice sets and recalc each best-effort. recalc
  //    runs installment cascade (covers refund-driven partial↔pending
  //    flip-backs). Service role has auth.uid() IS NULL so the helper's
  //    auth gate passes trivially. Never throws out — log and continue
  //    so a single bad invoice doesn't abort the whole cron pass.
  const recalcInvoiceIds = [...new Set([...flippedInvoiceIds, ...partialInvoiceIds])];
  let recalcOk = 0;
  let recalcFailed = 0;

  for (const invoiceId of recalcInvoiceIds) {
    const { error: recalcErr } = await supabase.rpc("recalculate_invoice_paid", {
      _invoice_id: invoiceId,
    });
    if (recalcErr) {
      console.error(`recalc failed for invoice ${invoiceId}:`, recalcErr.message);
      recalcFailed++;
    } else {
      recalcOk++;
    }
  }

  console.log(
    `Installment overdue check: ${overdueInstallments?.length || 0} installments marked overdue, ` +
    `${invoicesUpdated} invoices sent→overdue, ` +
    `${recalcInvoiceIds.length} invoices recalc'd (${recalcOk} ok, ${recalcFailed} failed)`
  );

  return new Response(JSON.stringify({
    success: true,
    installments_marked_overdue: overdueInstallments?.length || 0,
    invoices_updated: invoicesUpdated,
    invoices_recalculated: recalcOk,
    recalc_failed: recalcFailed,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
