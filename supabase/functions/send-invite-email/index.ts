import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface InviteEmailRequest {
  inviteId: string;
  orgId: string;
  orgName: string;
  recipientEmail: string;
  recipientRole: string;
  inviteToken: string;
  inviterName: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      inviteId,
      orgId,
      orgName,
      recipientEmail,
      recipientRole,
      inviteToken,
      inviterName,
    }: InviteEmailRequest = await req.json();

    // Build invite URL
    const frontendUrl = Deno.env.get("FRONTEND_URL") || req.headers.get("origin") || "https://lessonloop.net";
    const inviteUrl = `${frontendUrl}/accept-invite?token=${inviteToken}`;

    const subject = `You've been invited to join ${orgName}`;
    const body = `
      <h2>You're invited!</h2>
      <p>${inviterName} has invited you to join <strong>${orgName}</strong> as a <strong>${recipientRole}</strong>.</p>
      <p>Click the link below to accept the invitation and set up your account:</p>
      <p><a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
      <p>Or copy this link: ${inviteUrl}</p>
      <p>This invitation will expire in 7 days.</p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    `;

    // Log the message regardless of email provider status
    const { error: logError } = await supabase.from("message_log").insert({
      org_id: orgId,
      recipient_email: recipientEmail,
      recipient_name: null,
      message_type: "invite",
      subject,
      body,
      status: "pending",
      related_id: inviteId,
    });

    if (logError) {
      console.error("Error logging message:", logError);
    }

    // Check if Resend API key is configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      // Send email via Resend
      const resend = new Resend(resendApiKey);

      const emailResponse = await resend.emails.send({
        from: "LessonLoop <noreply@lessonloop.net>",
        to: [recipientEmail],
        subject,
        html: body,
      });

      // Update message log status
      await supabase
        .from("message_log")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("related_id", inviteId)
        .eq("message_type", "invite");

      console.log("Email sent successfully:", emailResponse);

      return new Response(
        JSON.stringify({ success: true, emailSent: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      // No email provider configured - just log
      console.log("No RESEND_API_KEY configured. Email logged but not sent.");
      console.log("Invite URL:", inviteUrl);

      await supabase
        .from("message_log")
        .update({ 
          status: "pending", 
          error_message: "No email provider configured. Invite URL: " + inviteUrl 
        })
        .eq("related_id", inviteId)
        .eq("message_type", "invite");

      return new Response(
        JSON.stringify({ 
          success: true, 
          emailSent: false, 
          message: "Invite created but email not sent (no email provider configured)",
          inviteUrl 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: any) {
    console.error("Error in send-invite-email:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
