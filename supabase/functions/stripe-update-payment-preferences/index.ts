import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * Updates guardian payment preferences (auto-pay toggle, default payment method).
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { orgId, autoPayEnabled, defaultPaymentMethodId } = await req.json();
    if (!orgId) throw new Error("orgId is required");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find guardian for this user
    const { data: guardian } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (!guardian) throw new Error("Guardian not found");

    // Build update payload
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof autoPayEnabled === "boolean") {
      updateData.auto_pay_enabled = autoPayEnabled;
    }
    if (typeof defaultPaymentMethodId === "string") {
      updateData.default_payment_method_id = defaultPaymentMethodId;
    }

    // Upsert preferences
    const { error: upsertError } = await supabase
      .from("guardian_payment_preferences")
      .upsert(
        {
          guardian_id: guardian.id,
          org_id: orgId,
          ...updateData,
        },
        { onConflict: "guardian_id,org_id" }
      );

    if (upsertError) throw new Error(upsertError.message);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in stripe-update-payment-preferences:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
