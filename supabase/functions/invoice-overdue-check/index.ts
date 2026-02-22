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

  // Transition all sent invoices past their due date to overdue
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .eq("status", "sent")
    .lt("due_date", new Date().toISOString().split("T")[0])
    .select("id");

  if (error) {
    console.error("Failed to update overdue invoices:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const count = data?.length ?? 0;
  console.log(`Marked ${count} invoice(s) as overdue`);

  return new Response(JSON.stringify({ updated: count }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
