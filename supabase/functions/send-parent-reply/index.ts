import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

interface ParentReplyRequest {
  org_id: string;
  parent_message_id: string; // the message being replied to
  body: string;
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

    // Rate limit: parents get stricter limits
    const rateLimitResult = await checkRateLimit(user.id, "send-parent-reply");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const data: ParentReplyRequest = await req.json();

    if (!data.org_id || !data.parent_message_id || !data.body?.trim()) {
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

    // Fetch the original message to get thread context and verify it was sent to this guardian
    const { data: originalMsg, error: msgError } = await supabase
      .from("message_log")
      .select("id, org_id, subject, thread_id, sender_user_id, recipient_id, recipient_type")
      .eq("id", data.parent_message_id)
      .eq("org_id", data.org_id)
      .single();

    if (msgError || !originalMsg) {
      return new Response(JSON.stringify({ error: "Original message not found" }), { status: 404, headers: jsonHeaders });
    }

    // Verify the parent is the recipient of this message
    if (originalMsg.recipient_id !== guardian.id || originalMsg.recipient_type !== "guardian") {
      return new Response(JSON.stringify({ error: "You cannot reply to this message" }), { status: 403, headers: jsonHeaders });
    }

    const threadId = originalMsg.thread_id || originalMsg.id;
    const replySubject = originalMsg.subject.startsWith("Re:") ? originalMsg.subject : `Re: ${originalMsg.subject}`;

    // Determine who to notify: the original sender, or the org owner
    let staffUserId = originalMsg.sender_user_id;
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

    // Fallback to org owner if no sender or no email
    if (!staffEmail) {
      const { data: ownerMembership } = await supabase
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", data.org_id)
        .eq("role", "owner")
        .eq("status", "active")
        .limit(1)
        .single();

      if (ownerMembership) {
        staffUserId = ownerMembership.user_id;
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", ownerMembership.user_id)
          .single();
        staffEmail = ownerProfile?.email || null;
        staffName = ownerProfile?.full_name || null;
      }
    }

    // Insert reply into message_log
    // Note: For parent replies, the parent is the "sender" and the staff member is the "recipient"
    const { data: replyLog, error: insertError } = await supabase
      .from("message_log")
      .insert({
        org_id: data.org_id,
        channel: "email",
        subject: replySubject,
        body: data.body.trim(),
        sender_user_id: user.id,
        recipient_type: "staff",
        recipient_id: staffUserId,
        recipient_email: staffEmail || "",
        recipient_name: staffName,
        related_id: null,
        message_type: "parent_reply",
        status: "pending",
        thread_id: threadId,
        parent_message_id: data.parent_message_id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating parent reply log:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save reply" }), { status: 500, headers: jsonHeaders });
    }

    // Get org name for email branding
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
            subject: replySubject,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <p style="color: #555; font-size: 14px; margin-bottom: 4px;">Reply from <strong>${escapeHtml(guardian.full_name)}</strong>:</p>
                <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 12px 0;">
                  <div style="white-space: pre-wrap; color: #333; line-height: 1.6;">
                    ${escapeHtml(data.body.trim()).replace(/\n/g, "<br>")}
                  </div>
                </div>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
                <p style="color: #999; font-size: 12px;">
                  This reply was sent via the ${escapeHtml(orgName)} parent portal on LessonLoop.
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
      .eq("id", replyLog.id);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: replyLog.id,
        thread_id: threadId,
        email_sent: emailSent,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error: any) {
    console.error("Error in send-parent-reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
