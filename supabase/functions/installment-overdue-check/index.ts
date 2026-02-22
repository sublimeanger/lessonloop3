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

  // 1. Mark overdue installments
  const { data: overdueInstallments, error: updateError } = await supabase
    .from("invoice_installments")
    .update({ status: "overdue" })
    .eq("status", "pending")
    .lt("due_date", today)
    .select("invoice_id");

  if (updateError) {
    console.error("Failed to mark overdue installments:", updateError);
    return new Response(JSON.stringify({ success: false, error: updateError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Update parent invoice status for any invoice with overdue installments
  const invoiceIds = [...new Set(
    (overdueInstallments || []).map((i: { invoice_id: string }) => i.invoice_id)
  )];

  let invoicesUpdated = 0;
  if (invoiceIds.length > 0) {
    const { data: updated, error: invoiceError } = await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .in("id", invoiceIds)
      .in("status", ["draft", "sent"])
      .select("id");

    if (invoiceError) {
      console.error("Failed to update invoice statuses:", invoiceError);
    } else {
      invoicesUpdated = updated?.length || 0;
    }
  }

  console.log(`Installment overdue check: ${overdueInstallments?.length || 0} installments marked overdue, ${invoicesUpdated} invoices updated`);

  return new Response(JSON.stringify({
    success: true,
    installments_marked_overdue: overdueInstallments?.length || 0,
    invoices_updated: invoicesUpdated,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
