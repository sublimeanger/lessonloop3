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

  // Get all orgs with their timezones so we compare due_date against
  // the org's local date, not UTC.
  const { data: orgs, error: orgError } = await supabase
    .from("organisations")
    .select("id, timezone");

  if (orgError) {
    console.error("Failed to fetch organisations:", orgError);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let totalUpdated = 0;
  let installmentsMarkedOverdue = 0;
  let planInvoicesUpdated = 0;

  for (const org of orgs || []) {
    const tz = org.timezone || "Europe/London";
    // Get today's date in the org's timezone
    const todayInOrg = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD

    // 1. Mark non-plan invoices as overdue (existing logic)
    const { data, error } = await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .eq("status", "sent")
      .eq("org_id", org.id)
      .eq("payment_plan_enabled", false)
      .lt("due_date", todayInOrg)
      .select("id");

    if (error) {
      console.error(`Failed to update overdue invoices for org ${org.id}:`, error);
    } else {
      totalUpdated += data?.length ?? 0;
    }

    // 2. Mark individual installments as overdue
    // Find pending installments past their due date for non-void/paid invoices
    const { data: eligibleInstallments } = await supabase
      .from("invoice_installments")
      .select("id, invoice_id, invoice:invoices!inner(status, org_id)")
      .eq("status", "pending")
      .lt("due_date", todayInOrg)
      .not("invoice.status", "in", "(void,paid)")
      .eq("invoice.org_id", org.id);

    const eligibleIds = (eligibleInstallments || []).map((i: any) => i.id);

    if (eligibleIds.length > 0) {
      const { data: updated, error: instError } = await supabase
        .from("invoice_installments")
        .update({ status: "overdue" })
        .in("id", eligibleIds)
        .select("invoice_id");

      if (instError) {
        console.error(`Failed to mark overdue installments for org ${org.id}:`, instError);
      } else {
        installmentsMarkedOverdue += updated?.length ?? 0;

        // 3. For payment plan invoices: only mark parent as overdue if ALL installments are overdue
        const affectedInvoiceIds = [...new Set((updated || []).map((i: any) => i.invoice_id))];

        for (const invId of affectedInvoiceIds) {
          // Check if any installments are still pending (not overdue/paid/void)
          const { data: pendingInst } = await supabase
            .from("invoice_installments")
            .select("id")
            .eq("invoice_id", invId)
            .eq("status", "pending")
            .limit(1);

          // Only mark parent overdue if no pending installments remain (all are overdue or paid)
          if (!pendingInst || pendingInst.length === 0) {
            const { data: invUpdated } = await supabase
              .from("invoices")
              .update({ status: "overdue" })
              .eq("id", invId)
              .in("status", ["draft", "sent"])
              .select("id");

            if (invUpdated && invUpdated.length > 0) {
              planInvoicesUpdated++;
            }
          }
        }
      }
    }
  }

  console.log(`Marked ${totalUpdated} non-plan invoice(s) as overdue, ${installmentsMarkedOverdue} installment(s) overdue, ${planInvoicesUpdated} plan invoice(s) overdue`);

  return new Response(JSON.stringify({
    updated: totalUpdated,
    installments_marked_overdue: installmentsMarkedOverdue,
    plan_invoices_updated: planInvoicesUpdated,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
