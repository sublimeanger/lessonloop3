import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

interface SendMessageRequest {
  org_id: string;
  sender_user_id: string;
  recipient_type: "guardian" | "student" | "teacher";
  recipient_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  related_id?: string;
  message_type?: string;
  thread_id?: string;
  parent_message_id?: string;
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

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(user.id, "send-message");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult.retryAfterSeconds);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data: SendMessageRequest = await req.json();

    // Validate required fields
    if (!data.org_id || !data.recipient_email || !data.subject || !data.body) {
      throw new Error("Missing required fields");
    }

    // Get org details for branding
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", data.org_id)
      .single();

    const orgName = org?.name || "LessonLoop";

    // Create message log entry
    const { data: messageLog, error: logError } = await supabase
      .from("message_log")
      .insert({
        org_id: data.org_id,
        channel: "email",
        subject: data.subject,
        body: data.body,
        sender_user_id: data.sender_user_id || user.id,
        recipient_type: data.recipient_type,
        recipient_id: data.recipient_id,
        recipient_email: data.recipient_email,
        recipient_name: data.recipient_name,
        related_id: data.related_id || null,
        message_type: data.message_type || "manual",
        status: "pending",
        thread_id: data.thread_id || null,
        parent_message_id: data.parent_message_id || null,
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating message log:", logError);
      throw new Error("Failed to create message log");
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
            to: [data.recipient_email],
            subject: data.subject,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${data.subject}</h2>
                <div style="white-space: pre-wrap; color: #555; line-height: 1.6;">
                  ${data.body.replace(/\n/g, "<br>")}
                </div>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
                <p style="color: #999; font-size: 12px;">
                  This message was sent via ${orgName} on LessonLoop.
                </p>
              </div>
            `,
          }),
        });

        if (resendResponse.ok) {
          const emailResult = await resendResponse.json();
          console.log("Email sent successfully:", emailResult);
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

    // Update message log with status
    await supabase
      .from("message_log")
      .update({
        status: emailSent ? "sent" : "failed",
        sent_at: emailSent ? new Date().toISOString() : null,
        error_message: errorMessage,
      })
      .eq("id", messageLog.id);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageLog.id,
        email_sent: emailSent,
        error: errorMessage,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-message function:", error);
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
