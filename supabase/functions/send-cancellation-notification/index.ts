import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

interface CancellationRequest {
  lessonIds: string[];
  lessonTitle: string;
  lessonDate: string;
  cancellationReason: string;
  orgName: string;
  orgId: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitResult = await checkRateLimit(user.id, "send-cancellation-notification");
    if (!rateLimitResult.allowed) return rateLimitResponse(corsHeaders, rateLimitResult);

    const { lessonIds, lessonTitle, lessonDate, cancellationReason, orgName, orgId }: CancellationRequest = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Get participants across all cancelled lessons
    const { data: participants } = await supabaseService
      .from("lesson_participants")
      .select("student_id")
      .in("lesson_id", lessonIds);

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No participants to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const studentIds = [...new Set(participants.map(p => p.student_id))];

    // Get guardians
    const { data: guardianLinks } = await supabaseService
      .from("student_guardians")
      .select("guardian:guardians(id, full_name, email, user_id)")
      .in("student_id", studentIds);

    if (!guardianLinks || guardianLinks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No guardians to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Deduplicate guardians
    const guardianMap = new Map<string, { id: string; full_name: string; email: string | null; user_id: string | null }>();
    for (const link of guardianLinks) {
      const guardian = link.guardian as any;
      if (guardian?.id && !guardianMap.has(guardian.id)) {
        guardianMap.set(guardian.id, guardian);
      }
    }

    const guardians = Array.from(guardianMap.values());
    const subject = `Lesson Cancelled: ${lessonTitle}`;
    const portalLink = `${FRONTEND_URL}/portal/schedule`;

    const buttonStyle = `display:inline-block;background-color:#2563eb;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;margin:20px 0;`;

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h1 style="color:#333;margin-bottom:20px;">Lesson Cancellation</h1>
        <p>Dear Parent/Guardian,</p>
        <p>We're writing to let you know that the following lesson has been cancelled:</p>
        <div style="background:#fef2f2;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #ef4444;">
          <p style="margin:5px 0;"><strong>Lesson:</strong> ${escapeHtml(lessonTitle)}</p>
          <p style="margin:5px 0;"><strong>Date:</strong> ${escapeHtml(lessonDate)}</p>
          <p style="margin:5px 0;"><strong>Reason:</strong> ${escapeHtml(cancellationReason)}</p>
        </div>
        <p style="text-align:center;">
          <a href="${portalLink}" style="${buttonStyle}">View Schedule</a>
        </p>
        <p>If you have any questions, please contact us.</p>
        <p>Thank you,<br>${escapeHtml(orgName)}</p>
      </div>
    `;

    let emailsSent = 0;
    let emailsLogged = 0;

    for (const guardian of guardians) {
      if (!guardian.email) continue;

      if (guardian.user_id) {
        const prefEnabled = await isNotificationEnabled(
          supabaseService, orgId, guardian.user_id, "email_lesson_reminders"
        );
        if (!prefEnabled) continue;
      }

      const { data: logEntry } = await supabaseService.from("message_log").insert({
        org_id: orgId,
        channel: "email",
        subject,
        body: `Lesson: ${lessonTitle}\nDate: ${lessonDate}\nReason: ${cancellationReason}`,
        sender_user_id: user.id,
        recipient_email: guardian.email,
        recipient_name: guardian.full_name,
        recipient_type: "guardian",
        recipient_id: guardian.id,
        related_id: lessonIds[0],
        message_type: "lesson_cancellation",
        status: resendApiKey ? "pending" : "logged",
      }).select('id').single();

      if (!resendApiKey) { emailsLogged++; continue; }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${orgName} <notifications@lessonloop.net>`,
          to: [guardian.email],
          subject,
          html: htmlContent,
        }),
      });

      if (response.ok) {
        emailsSent++;
        if (logEntry) {
          await supabaseService.from("message_log")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", logEntry.id);
        }
      } else {
        const result = await response.json();
        console.error("Failed to send cancellation email:", result);
        if (logEntry) {
          await supabaseService.from("message_log")
            .update({ status: "failed", error_message: JSON.stringify(result) })
            .eq("id", logEntry.id);
        }
      }
    }

    console.log(`Cancellation notification: ${emailsSent} sent, ${emailsLogged} logged`);

    return new Response(
      JSON.stringify({ success: true, emailsSent, emailsLogged }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-cancellation-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
