import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

interface NotifyInternalRequest {
  org_id: string;
  recipient_user_id: string;
  sender_name: string;
  sender_role: string;
  subject: string;
  body: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const data: NotifyInternalRequest = await req.json();

    // Validate required fields
    if (!data.org_id || !data.recipient_user_id || !data.subject || !data.body) {
      throw new Error("Missing required fields");
    }

    // Verify sender is a staff member of the org
    const { data: senderMembership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", data.org_id)
      .eq("status", "active")
      .single();

    if (!senderMembership || !["owner", "admin", "teacher"].includes(senderMembership.role)) {
      return new Response(
        JSON.stringify({ error: "Not a member of this organisation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify recipient is also a member of the same org
    const { data: recipientMembership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", data.recipient_user_id)
      .eq("org_id", data.org_id)
      .eq("status", "active")
      .single();

    if (!recipientMembership) {
      return new Response(
        JSON.stringify({ error: "Recipient is not a member of this organisation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org name for branding
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", data.org_id)
      .single();

    const orgName = org?.name || "LessonLoop";

    // Get recipient's email from profiles
    const { data: recipientProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", data.recipient_user_id)
      .single();

    if (profileError || !recipientProfile?.email) {
      console.log("Recipient email not found, skipping notification");
      return new Response(
        JSON.stringify({ success: true, email_sent: false, reason: "No email found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let emailSent = false;
    let errorMessage = null;

    // Send email via Resend if API key is configured
    if (resendApiKey) {
      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${orgName} <notifications@lessonloop.net>`,
            to: [recipientProfile.email],
            subject: `[Internal] ${data.subject}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #666; font-size: 14px;">
                    Internal message from <strong>${escapeHtml(data.sender_name)}</strong> (${escapeHtml(data.sender_role)})
                  </p>
                </div>
                <h2 style="color: #333; margin-bottom: 16px;">${escapeHtml(data.subject)}</h2>
                <div style="white-space: pre-wrap; color: #555; line-height: 1.6;">
                  ${escapeHtml(data.body).replace(/\n/g, "<br>")}
                </div>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
                <p style="color: #999; font-size: 12px;">
                  This is an internal message from ${escapeHtml(orgName)}. 
                  <a href="https://lessonloop.lovable.app/messages" style="color: #666;">View in LessonLoop</a>
                </p>
              </div>
            `,
          }),
        });

        if (resendResponse.ok) {
          const emailResult = await resendResponse.json();
          console.log("Internal notification sent, id:", emailResult?.id);
          emailSent = true;
        } else {
          const errorResult = await resendResponse.text();
          console.error("Resend API error:", errorResult);
          errorMessage = `Email send failed: ${errorResult}`;
        }
      } catch (emailError: any) {
        console.error("Error sending email via Resend:", emailError);
        errorMessage = emailError.message;
      }
    } else {
      console.log("RESEND_API_KEY not configured, email not sent");
      errorMessage = "Email service not configured";
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        error: errorMessage,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-internal-message function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
