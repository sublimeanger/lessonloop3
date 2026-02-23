import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

/**
 * Unified edge function for parent-initiated messages.
 * Handles both new conversations and replies to existing threads.
 *
 * Body:
 *   org_id: string (required)
 *   subject?: string (required for new conversations)
 *   body: string (required)
 *   student_id?: string (optional, links to student)
 *   parent_message_id?: string (if replying to an existing message)
 */

interface SendParentMessageRequest {
  org_id: string;
  subject?: string;
  body: string;
  student_id?: string;
  parent_message_id?: string; // present = reply, absent = new conversation
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

    // ── 1. Authenticate via JWT ──
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

    // ── Rate limit: 20 messages/hour ──
    const rateLimitResult = await checkRateLimit(user.id, "send-parent-message");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const data: SendParentMessageRequest = await req.json();

    if (!data.org_id || !data.body?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: jsonHeaders });
    }

    const isReply = !!data.parent_message_id;

    if (!isReply && !data.subject?.trim()) {
      return new Response(JSON.stringify({ error: "Subject is required for new conversations" }), { status: 400, headers: jsonHeaders });
    }

    // ── 2. Verify parent is a guardian in the org ──
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

    // ── 3. Fetch org_messaging_settings ──
    const { data: msgSettings } = await supabase
      .from("org_messaging_settings")
      .select("parent_can_initiate, parent_can_message_teacher, auto_assign_to_teacher, notify_staff_on_new_message")
      .eq("org_id", data.org_id)
      .maybeSingle();

    const canInitiate = msgSettings?.parent_can_initiate ?? true;
    const canMessageTeacher = msgSettings?.parent_can_message_teacher ?? false;
    const autoAssignToTeacher = msgSettings?.auto_assign_to_teacher ?? false;
    const shouldNotifyStaff = msgSettings?.notify_staff_on_new_message ?? true;

    // For new conversations, check parent_can_initiate
    if (!isReply && !canInitiate) {
      return new Response(
        JSON.stringify({ error: "Your organisation has disabled parent-initiated messages. You can still reply to messages sent to you." }),
        { status: 403, headers: jsonHeaders }
      );
    }

    // ── 4. Determine thread context and recipient ──
    let threadId: string | null = null;
    let subject: string;
    let staffUserId: string | null = null;
    let staffEmail: string | null = null;
    let staffName: string | null = null;
    let staffRole: string | null = null;

    if (isReply) {
      // ── Reply path ──
      const { data: originalMsg, error: msgError } = await supabase
        .from("message_log")
        .select("id, org_id, subject, thread_id, sender_user_id, recipient_id, recipient_type")
        .eq("id", data.parent_message_id!)
        .eq("org_id", data.org_id)
        .single();

      if (msgError || !originalMsg) {
        return new Response(JSON.stringify({ error: "Original message not found" }), { status: 404, headers: jsonHeaders });
      }

      // Verify the parent is either the recipient or the original sender of this thread
      const isRecipient = originalMsg.recipient_id === guardian.id && originalMsg.recipient_type === "guardian";
      const isOriginalSender = originalMsg.sender_user_id === user.id;
      if (!isRecipient && !isOriginalSender) {
        return new Response(JSON.stringify({ error: "You cannot reply to this message" }), { status: 403, headers: jsonHeaders });
      }

      threadId = originalMsg.thread_id || originalMsg.id;
      subject = originalMsg.subject.startsWith("Re:") ? originalMsg.subject : `Re: ${originalMsg.subject}`;

      // Reply goes to the original sender (staff)
      staffUserId = originalMsg.sender_user_id;
    } else {
      // ── New conversation path ──
      subject = data.subject!.trim();

      // If auto_assign_to_teacher and student linked, find student's teacher
      if (autoAssignToTeacher && data.student_id) {
        const { data: assignment } = await supabase
          .from("student_teacher_assignments")
          .select("teacher_user_id, teachers!inner(user_id, display_name)")
          .eq("student_id", data.student_id)
          .eq("org_id", data.org_id)
          .limit(1)
          .maybeSingle();

        if (assignment?.teacher_user_id) {
          // Check if parent can message teachers
          if (!canMessageTeacher) {
            // Fall through to admin/owner instead
            console.log("auto_assign_to_teacher is on but parent_can_message_teacher is off — routing to admin");
          } else {
            staffUserId = assignment.teacher_user_id;
            staffRole = "teacher";
          }
        }
      }
    }

    // Resolve staff profile if we have a user id
    if (staffUserId) {
      const { data: staffProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", staffUserId)
        .single();
      staffEmail = staffProfile?.email || null;
      staffName = staffProfile?.full_name || null;

      // If replying, check if this staff member is a teacher and whether that's allowed
      if (!staffRole) {
        const { data: membership } = await supabase
          .from("org_memberships")
          .select("role")
          .eq("user_id", staffUserId)
          .eq("org_id", data.org_id)
          .eq("status", "active")
          .maybeSingle();
        staffRole = membership?.role || null;
      }

      // Enforce parent_can_message_teacher
      if (staffRole === "teacher" && !canMessageTeacher) {
        return new Response(
          JSON.stringify({ error: "Your organisation does not allow parents to message teachers directly. Please contact the admin team instead." }),
          { status: 403, headers: jsonHeaders }
        );
      }
    }

    // Fallback: if no staff recipient, find org owner/admin
    if (!staffUserId || !staffEmail) {
      const { data: adminMembership } = await supabase
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", data.org_id)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .order("role", { ascending: true })
        .limit(1)
        .single();

      if (adminMembership) {
        staffUserId = adminMembership.user_id;
        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", adminMembership.user_id)
          .single();
        staffEmail = adminProfile?.email || null;
        staffName = adminProfile?.full_name || null;
      }
    }

    // ── 5. Insert message into message_log ──
    const messageType = isReply ? "parent_reply" : "parent_enquiry";

    const { data: msgLog, error: insertError } = await supabase
      .from("message_log")
      .insert({
        org_id: data.org_id,
        channel: "email",
        subject,
        body: data.body.trim(),
        sender_user_id: user.id,
        recipient_type: "staff",
        recipient_id: staffUserId,
        recipient_email: staffEmail || "",
        recipient_name: staffName,
        related_id: data.student_id || null,
        message_type: messageType,
        status: "pending",
        thread_id: threadId,
        parent_message_id: isReply ? data.parent_message_id! : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating parent message:", insertError);
      return new Response(JSON.stringify({ error: "Failed to send message" }), { status: 500, headers: jsonHeaders });
    }

    // ── 6. Send email notification to staff via Resend ──
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", data.org_id)
      .single();
    const orgName = org?.name || "LessonLoop";

    let emailSent = false;
    let errorMessage: string | null = null;

    if (resendApiKey && staffEmail && shouldNotifyStaff) {
      try {
        const emailSubject = isReply
          ? subject
          : `New message from ${guardian.full_name}: ${subject}`;

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${orgName} <notifications@lessonloop.net>`,
            to: [staffEmail],
            subject: emailSubject,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <p style="color: #555; font-size: 14px; margin-bottom: 4px;">
                  ${isReply ? "Reply" : "New message"} from <strong>${escapeHtml(guardian.full_name)}</strong>:
                </p>
                ${!isReply ? `<h3 style="margin: 8px 0; color: #333;">${escapeHtml(subject)}</h3>` : ""}
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

    // ── 7. Update message status ──
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
        thread_id: threadId || msgLog.id,
        email_sent: emailSent,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error: any) {
    console.error("Error in send-parent-message:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: jsonHeaders }
    );
  }
};

serve(handler);
