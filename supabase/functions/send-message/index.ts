import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/escape-html.ts";
import { log, logError as safeLogError } from "../_shared/log.ts";

interface SendMessageRequest {
  org_id: string;
  sender_user_id: string;
  recipient_type: "guardian" | "student" | "teacher";
  recipient_id: string;
  /** @deprecated Client-supplied email is ignored; resolved from DB instead. */
  recipient_email?: string;
  /** @deprecated Client-supplied name is ignored; resolved from DB instead. */
  recipient_name?: string;
  subject: string;
  body: string;
  related_id?: string;
  message_type?: string;
  thread_id?: string;
  parent_message_id?: string;
  /** When false, only creates in-app message without sending email. Defaults to true for backward compat. */
  send_email?: boolean;
}

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";
const PORTAL_URL = `${FRONTEND_URL}/portal/messages`;

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

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(user.id, "send-message");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data: SendMessageRequest = await req.json();

    // Default send_email to true for backward compatibility
    const shouldSendEmail = data.send_email !== false;

    // Validate required fields
    if (!data.org_id || !data.recipient_id || !data.recipient_type || !data.subject || !data.body) {
      throw new Error("Missing required fields");
    }

    // MSG-L2: body-length validation
    if (data.body.length > 10000 || data.subject.length > 500) {
      return new Response(
        JSON.stringify({ error: "Message content too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is a staff member of the specified org
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", data.org_id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin", "teacher"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Not a member of this organisation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Always use authenticated user's ID as sender to prevent impersonation
    const senderId = user.id;

    // Resolve recipient email and name from the database — never trust client input
    let recipientEmail: string | null = null;
    let recipientName: string | null = null;

    if (data.recipient_type === "guardian") {
      const { data: guardian, error: guardianError } = await supabase
        .from("guardians")
        .select("email, full_name, org_id")
        .eq("id", data.recipient_id)
        .single();
      if (guardianError || !guardian) {
        return new Response(
          JSON.stringify({ error: "Recipient not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (guardian.org_id !== data.org_id) {
        return new Response(
          JSON.stringify({ error: "Recipient does not belong to this organisation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      recipientEmail = guardian.email;
      recipientName = guardian.full_name;
    } else if (data.recipient_type === "student") {
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("email, first_name, last_name, org_id")
        .eq("id", data.recipient_id)
        .single();
      if (studentError || !student) {
        return new Response(
          JSON.stringify({ error: "Recipient not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (student.org_id !== data.org_id) {
        return new Response(
          JSON.stringify({ error: "Recipient does not belong to this organisation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      recipientEmail = student.email;
      recipientName = `${student.first_name} ${student.last_name}`.trim();
    } else if (data.recipient_type === "teacher") {
      const { data: teacher, error: teacherError } = await supabase
        .from("teachers")
        .select("display_name, user_id, org_id")
        .eq("id", data.recipient_id)
        .single();
      if (teacherError || !teacher) {
        return new Response(
          JSON.stringify({ error: "Recipient not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (teacher.org_id !== data.org_id) {
        return new Response(
          JSON.stringify({ error: "Recipient does not belong to this organisation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      recipientName = teacher.display_name;
      // Get email from auth user
      if (teacher.user_id) {
        const { data: teacherUser } = await supabase.auth.admin.getUserById(teacher.user_id);
        recipientEmail = teacherUser?.user?.email || null;
      }
    }

    if (!recipientEmail) {
      // No email on file — can still create in-app message but cannot send email
      if (data.send_email !== false) {
        return new Response(
          JSON.stringify({ error: "Recipient has no email address on file" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
        channel: shouldSendEmail ? "email" : "inapp",
        subject: data.subject,
        body: data.body,
        sender_user_id: senderId,
        recipient_type: data.recipient_type,
        recipient_id: data.recipient_id,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        related_id: data.related_id || null,
        message_type: data.message_type || "manual",
        status: shouldSendEmail ? "pending" : "sent",
        sent_at: shouldSendEmail ? null : new Date().toISOString(),
        thread_id: data.thread_id || null,
        parent_message_id: data.parent_message_id || null,
      })
      .select()
      .single();

    if (logError) {
      safeLogError("Error creating message log:", logError);
      throw new Error("Failed to create message log");
    }

    // If not sending email, return immediately with success
    if (!shouldSendEmail) {
      return new Response(
        JSON.stringify({
          success: true,
          message_id: messageLog.id,
          email_sent: false,
          channel: "inapp",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
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
            to: [recipientEmail!],
            subject: data.subject,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">${escapeHtml(data.subject)}</h2>
                <div style="white-space: pre-wrap; color: #555; line-height: 1.6;">
                  ${escapeHtml(data.body).replace(/\n/g, "<br>")}
                </div>
                <div style="margin: 32px 0; text-align: center;">
                  <a href="${PORTAL_URL}" style="display: inline-block; padding: 12px 28px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                    Reply in Your Portal
                  </a>
                </div>
                <p style="color: #999; font-size: 12px; text-align: center;">
                  To reply to this message, please log in to your parent portal using the button above.
                </p>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
                <p style="color: #999; font-size: 12px;">
                  This message was sent via ${escapeHtml(orgName)} on LessonLoop.
                </p>
              </div>
            `,
          }),
        });

        if (resendResponse.ok) {
          const emailResult = await resendResponse.json();
          log("Email sent successfully, id:", emailResult?.id);
          emailSent = true;
        } else {
          const errorResult = await resendResponse.text();
          safeLogError("Resend API error:", errorResult);
          errorMessage = `Email send failed: ${errorResult}`;
        }
      } catch (emailError: any) {
        safeLogError("Error sending email via Resend:", emailError);
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
    safeLogError("Error in send-message function:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
