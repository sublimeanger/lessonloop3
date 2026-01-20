import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { proposalId, action } = await req.json();

    if (action === "confirm") {
      // Get the proposal
      const { data: proposal, error: fetchError } = await supabase
        .from("ai_action_proposals")
        .select("*")
        .eq("id", proposalId)
        .eq("user_id", user.id)
        .single();

      if (fetchError || !proposal) {
        return new Response(JSON.stringify({ error: "Proposal not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (proposal.status !== "proposed") {
        return new Response(JSON.stringify({ error: "Proposal already processed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute based on proposal type
      let result: Record<string, unknown> = {};
      let newStatus = "executed";

      try {
        const proposalData = proposal.proposal as Record<string, unknown>;
        const actionType = proposalData.type as string;

        switch (actionType) {
          case "send_invoice_reminder": {
            const invoiceId = proposalData.invoiceId as string;
            // Call the send-invoice-email function
            const { error: sendError } = await supabase.functions.invoke("send-invoice-email", {
              body: { invoiceId, type: "reminder" },
            });
            if (sendError) throw sendError;
            result = { message: "Invoice reminder sent successfully" };
            break;
          }

          case "draft_email": {
            // Store draft in message_log as draft status
            const { error: draftError } = await supabase.from("message_log").insert({
              org_id: proposal.org_id,
              sender_user_id: user.id,
              recipient_email: proposalData.recipientEmail as string,
              recipient_name: proposalData.recipientName as string,
              subject: proposalData.subject as string,
              body: proposalData.body as string,
              message_type: "email",
              status: "draft",
            });
            if (draftError) throw draftError;
            result = { message: "Email draft created" };
            break;
          }

          default:
            result = { message: `Action type '${actionType}' acknowledged` };
        }
      } catch (execError) {
        console.error("Execution error:", execError);
        newStatus = "failed";
        result = { error: execError instanceof Error ? execError.message : "Execution failed" };
      }

      // Update proposal status
      await supabase
        .from("ai_action_proposals")
        .update({
          status: newStatus,
          result,
          executed_at: new Date().toISOString(),
        })
        .eq("id", proposalId);

      return new Response(JSON.stringify({ success: newStatus === "executed", result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "cancel") {
      await supabase
        .from("ai_action_proposals")
        .update({ status: "cancelled" })
        .eq("id", proposalId)
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, message: "Proposal cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Execute error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
