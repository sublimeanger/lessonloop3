import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://id-preview--c541d756-90e7-442a-ba85-0c723aeabc14.lovable.app";

interface NotesNotificationRequest {
  lessonId: string;
  notesShared: string;
  lessonTitle: string;
  lessonDate: string;
  teacherName: string;
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
    const rateLimitResult = await checkRateLimit(user.id, "send-notes-notification");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult.retryAfterSeconds);
    }

    const {
      lessonId,
      notesShared,
      lessonTitle,
      lessonDate,
      teacherName,
      orgName,
      orgId,
    }: NotesNotificationRequest = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Get lesson participants and their guardians
    const { data: participants } = await supabaseService
      .from("lesson_participants")
      .select("student_id")
      .eq("lesson_id", lessonId);

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No participants to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const studentIds = participants.map(p => p.student_id);

    // Get guardians for these students
    const { data: guardianLinks } = await supabaseService
      .from("student_guardians")
      .select(`
        guardian:guardians(id, full_name, email, user_id)
      `)
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
      if (guardian && guardian.id && !guardianMap.has(guardian.id)) {
        guardianMap.set(guardian.id, guardian);
      }
    }

    const guardians = Array.from(guardianMap.values());
    const portalLink = `${FRONTEND_URL}/portal/schedule`;
    const subject = `Lesson Update: ${lessonTitle}`;

    const buttonStyle = `
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    `.replace(/\s+/g, ' ').trim();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; margin-bottom: 20px;">Lesson Notes Update</h1>
        <p>Dear Parent/Guardian,</p>
        <p>${teacherName} has added notes for an upcoming lesson:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Lesson:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> ${lessonDate}</p>
          <p style="margin: 15px 0 5px;"><strong>Notes:</strong></p>
          <p style="margin: 5px 0; white-space: pre-wrap; background: #fff; padding: 10px; border-radius: 4px;">${notesShared}</p>
        </div>
        <p style="text-align: center;">
          <a href="${portalLink}" style="${buttonStyle}">View in Portal</a>
        </p>
        <p>Thank you,<br>${orgName}</p>
      </div>
    `;

    let emailsSent = 0;
    let emailsLogged = 0;

    for (const guardian of guardians) {
      if (!guardian.email) continue;

      // Log message
      await supabaseService.from("message_log").insert({
        org_id: orgId,
        channel: "email",
        subject,
        body: htmlContent,
        sender_user_id: user.id,
        recipient_email: guardian.email,
        recipient_name: guardian.full_name,
        recipient_type: "guardian",
        recipient_id: guardian.id,
        related_id: lessonId,
        message_type: "lesson_notes",
        status: resendApiKey ? "pending" : "logged",
      });

      if (!resendApiKey) {
        emailsLogged++;
        continue;
      }

      // Send email via Resend
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${orgName} <notifications@lessonloop.net>`,
          to: [guardian.email],
          subject,
          html: htmlContent,
        }),
      });

      if (response.ok) {
        emailsSent++;
        // Update message log
        await supabaseService
          .from("message_log")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("related_id", lessonId)
          .eq("message_type", "lesson_notes")
          .eq("recipient_id", guardian.id)
          .order("created_at", { ascending: false })
          .limit(1);
      } else {
        const result = await response.json();
        console.error("Failed to send email:", result);
        await supabaseService
          .from("message_log")
          .update({ status: "failed", error_message: JSON.stringify(result) })
          .eq("related_id", lessonId)
          .eq("message_type", "lesson_notes")
          .eq("recipient_id", guardian.id)
          .order("created_at", { ascending: false })
          .limit(1);
      }
    }

    console.log(`Notes notification: ${emailsSent} sent, ${emailsLogged} logged`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        emailsLogged,
        message: resendApiKey 
          ? `Notified ${emailsSent} guardian(s)` 
          : `Logged ${emailsLogged} notification(s) (Resend not configured)` 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-notes-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
