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

  for (const org of orgs || []) {
    const tz = org.timezone || "Europe/London";
    // Get today's date in the org's timezone
    const todayInOrg = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD

    const { data, error } = await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .eq("status", "sent")
      .eq("org_id", org.id)
      .lt("due_date", todayInOrg)
      .select("id");

    if (error) {
      console.error(`Failed to update overdue invoices for org ${org.id}:`, error);
      continue;
    }

    totalUpdated += data?.length ?? 0;
  }

  console.log(`Marked ${totalUpdated} invoice(s) as overdue`);

  return new Response(JSON.stringify({ updated: totalUpdated }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
