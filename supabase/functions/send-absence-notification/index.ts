import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml, sanitiseFromName } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

interface AbsenceNotificationRequest {
  org_id: string;
  student_id: string;
  lesson_id: string;
  lesson_title: string;
  lesson_date: string; // ISO string
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id, "send-absence-notification");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    const {
      org_id: orgId,
      student_id: studentId,
      lesson_id: lessonId,
      lesson_title: lessonTitle,
      lesson_date: lessonDate,
    }: AbsenceNotificationRequest = await req.json();

    if (!orgId || !studentId || !lessonId || !lessonTitle || !lessonDate) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: org_id, student_id, lesson_id, lesson_title, lesson_date" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Verify sender is a staff member of the org
    const { data: senderMembership } = await supabaseService
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("status", "active")
      .single();

    if (!senderMembership || !["owner", "admin", "teacher"].includes(senderMembership.role)) {
      return new Response(
        JSON.stringify({ error: "Not a member of this organisation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Rate limit: 1 notification per student per lesson (prevent duplicates) ──
    const { data: existingLog } = await supabaseService
      .from("message_log")
      .select("id")
      .eq("related_id", lessonId)
      .eq("message_type", "absence_notification")
      .eq("org_id", orgId)
      .like("body", `%student_id:${studentId}%`)
      .limit(1);

    if (existingLog && existingLog.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Notification already sent for this student/lesson" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org name
    const { data: org } = await supabaseService
      .from("organisations")
      .select("name")
      .eq("id", orgId)
      .single();

    const orgName = org?.name || "LessonLoop";

    // Get student name
    const { data: student } = await supabaseService
      .from("students")
      .select("first_name, last_name")
      .eq("id", studentId)
      .single();

    if (!student) {
      return new Response(
        JSON.stringify({ error: "Student not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const studentFirstName = student.first_name;

    // Get guardians for this student (active, with user_id linked)
    const { data: guardianLinks } = await supabaseService
      .from("student_guardians")
      .select(`
        guardian:guardians!inner(id, full_name, email, user_id, deleted_at)
      `)
      .eq("student_id", studentId);

    if (!guardianLinks || guardianLinks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No guardians to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate and filter: user_id IS NOT NULL, deleted_at IS NULL, has email
    const guardianMap = new Map<string, { id: string; full_name: string; email: string; user_id: string }>();
    for (const link of guardianLinks) {
      const guardian = link.guardian as any;
      if (
        guardian?.id &&
        guardian.user_id &&
        !guardian.deleted_at &&
        guardian.email &&
        !guardianMap.has(guardian.id)
      ) {
        guardianMap.set(guardian.id, guardian);
      }
    }

    const guardians = Array.from(guardianMap.values());

    if (guardians.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No eligible guardians to notify" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format date for display
    const dateObj = new Date(lessonDate);
    const formattedDate = dateObj.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const subject = `${studentFirstName} was absent from ${lessonTitle}`;
    const portalLink = `${FRONTEND_URL}/portal/schedule`;

    const buttonStyle = `
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    `.replace(/\s+/g, " ").trim();

    let emailsSent = 0;
    let emailsLogged = 0;
    let pushSent = 0;

    for (const guardian of guardians) {
      // Check if guardian has lesson reminders enabled
      const prefEnabled = await isNotificationEnabled(
        supabaseService, orgId, guardian.user_id, "email_lesson_reminders"
      );
      if (!prefEnabled) {
        console.log(`Guardian ${guardian.email} has lesson reminders disabled, skipping`);
        continue;
      }

      const guardianFirstName = guardian.full_name.split(" ")[0] || "Parent";

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; margin-bottom: 20px;">Absence Notification</h1>
          <p>Hi ${escapeHtml(guardianFirstName)},</p>
          <p>This is to let you know that <strong>${escapeHtml(studentFirstName)}</strong> was recorded as absent from <strong>${escapeHtml(lessonTitle)}</strong> on <strong>${escapeHtml(formattedDate)}</strong>.</p>
          <p>If you believe this is an error, please contact ${escapeHtml(orgName)}.</p>
          <p>If a make-up credit has been issued, you'll see it in your parent portal.</p>
          <p style="text-align: center;">
            <a href="${portalLink}" style="${buttonStyle}">View in Portal</a>
          </p>
          <p>Thank you,<br>${escapeHtml(orgName)}</p>
        </div>
      `;

      const plainBody = `Hi ${guardianFirstName},\n\nThis is to let you know that ${studentFirstName} was recorded as absent from ${lessonTitle} on ${formattedDate}.\n\nIf you believe this is an error, please contact ${orgName}.\n\nIf a make-up credit has been issued, you'll see it in your parent portal.`;

      // Log message (includes student_id tag for dedup)
      const { data: logEntry } = await supabaseService.from("message_log").insert({
        org_id: orgId,
        channel: "email",
        subject,
        body: `student_id:${studentId}\n${plainBody}`,
        sender_user_id: user.id,
        recipient_email: guardian.email,
        recipient_name: guardian.full_name,
        recipient_type: "guardian",
        recipient_id: guardian.id,
        related_id: lessonId,
        message_type: "absence_notification",
        status: resendApiKey ? "pending" : "logged",
      }).select("id").single();

      if (!resendApiKey) {
        emailsLogged++;
      } else {
        // Send email via Resend
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${sanitiseFromName(orgName)} <notifications@lessonloop.net>`,
            to: [guardian.email],
            subject,
            html: htmlContent,
            headers: {
              "List-Unsubscribe": `<${FRONTEND_URL}/portal/settings?tab=notifications>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });

        if (response.ok) {
          emailsSent++;
          if (logEntry) {
            await supabaseService
              .from("message_log")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", logEntry.id);
          }
        } else {
          const result = await response.json();
          console.error("Failed to send absence email:", result);
          if (logEntry) {
            await supabaseService
              .from("message_log")
              .update({ status: "failed", error_message: JSON.stringify(result) })
              .eq("id", logEntry.id);
          }
        }
      }

      // Send push notification (fire-and-forget)
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: guardian.user_id,
            title: `${studentFirstName} was absent`,
            body: `${studentFirstName} was recorded as absent from ${lessonTitle} on ${formattedDate}.`,
            data: { type: "absence_notification", lessonId },
          }),
        });
        pushSent++;
      } catch (pushErr) {
        console.error("Push notification failed:", pushErr);
      }
    }

    console.log(`Absence notification: ${emailsSent} sent, ${emailsLogged} logged, ${pushSent} push`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        emailsLogged,
        pushSent,
        message: resendApiKey
          ? `Notified ${emailsSent} guardian(s)`
          : `Logged ${emailsLogged} notification(s) (Resend not configured)`,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-absence-notification:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
