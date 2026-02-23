import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

interface ParentEnquiryRequest {
  org_id: string;
  subject: string;
  body: string;
  student_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });
    }

    // Rate limit
    const rateLimitResult = await checkRateLimit(user.id, "send-parent-reply");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const data: ParentEnquiryRequest = await req.json();

    if (!data.org_id || !data.subject?.trim() || !data.body?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: jsonHeaders });
    }

    // Verify user is a guardian in this org
    const { data: guardian, error: guardianError } = await supabase
      .from("guardians")
      .select("id, full_name, email")
      .eq("user_id", user.id)
      .eq("org_id", data.org_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (guardianError || !guardian) {
      return new Response(JSON.stringify({ error: "Not a parent in this organisation" }), { status: 403, headers: jsonHeaders });
    }

    // Find org owner/admin to notify
    const { data: adminMembership } = await supabase
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", data.org_id)
      .in("role", ["owner", "admin"])
      .eq("status", "active")
      .order("role", { ascending: true }) // owner first
      .limit(1)
      .single();

    let staffUserId = adminMembership?.user_id || null;
    let staffEmail: string | null = null;
    let staffName: string | null = null;

    if (staffUserId) {
      const { data: staffProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", staffUserId)
        .single();
      staffEmail = staffProfile?.email || null;
      staffName = staffProfile?.full_name || null;
    }

    // Insert the enquiry as a message_log entry (parent-initiated conversation)
    const { data: msgLog, error: insertError } = await supabase
      .from("message_log")
      .insert({
        org_id: data.org_id,
        channel: "email",
        subject: data.subject.trim(),
        body: data.body.trim(),
        sender_user_id: user.id,
        recipient_type: "staff",
        recipient_id: staffUserId,
        recipient_email: staffEmail || "",
        recipient_name: staffName,
        related_id: data.student_id || null,
        message_type: "parent_enquiry",
        status: "pending",
        thread_id: null, // This message becomes its own thread root
        parent_message_id: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating parent enquiry:", insertError);
      return new Response(JSON.stringify({ error: "Failed to send enquiry" }), { status: 500, headers: jsonHeaders });
    }

    // Get org name
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", data.org_id)
      .single();
    const orgName = org?.name || "LessonLoop";

    let emailSent = false;
    let errorMessage: string | null = null;

    // Send email notification to staff
    if (resendApiKey && staffEmail) {
      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${orgName} <notifications@lessonloop.net>`,
            to: [staffEmail],
            subject: `New enquiry from ${guardian.full_name}: ${data.subject.trim()}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <p style="color: #555; font-size: 14px; margin-bottom: 4px;">New enquiry from <strong>${escapeHtml(guardian.full_name)}</strong>:</p>
                <h3 style="margin: 8px 0; color: #333;">${escapeHtml(data.subject.trim())}</h3>
                <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 12px 0;">
                  <div style="white-space: pre-wrap; color: #333; line-height: 1.6;">
                    ${escapeHtml(data.body.trim()).replace(/\n/g, "<br>")}
                  </div>
                </div>
                <p style="color: #555; font-size: 14px;">Reply via the Messages page in your ${escapeHtml(orgName)} dashboard.</p>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
                <p style="color: #999; font-size: 12px;">
                  This message was sent via the ${escapeHtml(orgName)} parent portal on LessonLoop.
                </p>
              </div>
            `,
          }),
        });

        if (resendResponse.ok) {
          await resendResponse.json();
          emailSent = true;
        } else {
          errorMessage = `Email send failed: ${await resendResponse.text()}`;
          console.error("Resend API error:", errorMessage);
        }
      } catch (emailError: any) {
        console.error("Error sending email:", emailError);
        errorMessage = emailError.message;
      }
    } else if (!resendApiKey) {
      errorMessage = "Email service not configured";
    } else if (!staffEmail) {
      errorMessage = "No staff email found";
    }

    // Update message log status
    await supabase
      .from("message_log")
      .update({
        status: emailSent ? "sent" : "failed",
        sent_at: emailSent ? new Date().toISOString() : null,
        error_message: errorMessage,
      })
      .eq("id", msgLog.id);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: msgLog.id,
        email_sent: emailSent,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error: any) {
    console.error("Error in send-parent-enquiry:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: jsonHeaders }
    );
  }
};

serve(handler);
