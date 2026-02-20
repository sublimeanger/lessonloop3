import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/escape-html.ts";
import { validateCronAuth } from "../_shared/cron-auth.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find orgs where trial has expired (trial_ends_at <= now) and still on trialing status
    const now = new Date();
    
    const { data: orgs, error: orgsError } = await supabase
      .from("organisations")
      .select("id, name, created_by")
      .eq("subscription_status", "trialing")
      .lte("trial_ends_at", now.toISOString());

    if (orgsError) {
      throw orgsError;
    }

    console.log(`Found ${orgs?.length || 0} expired trials to process`);

    const results = [];
    for (const org of orgs || []) {
      // Update subscription status to expired
      const { error: updateError } = await supabase
        .from("organisations")
        .update({ subscription_status: "cancelled" }) // Using 'cancelled' as per the enum
        .eq("id", org.id);

      if (updateError) {
        console.error(`Failed to update org ${org.id}:`, updateError);
        continue;
      }

      // Get owner's email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", org.created_by)
        .single();

      if (!profile?.email) {
        results.push({ orgId: org.id, status: "updated_no_email" });
        continue;
      }

      const firstName = profile.full_name?.split(" ")[0] || "there";

      try {
        await resend.emails.send({
          from: "LessonLoop <hello@lessonloop.net>",
          to: [profile.email],
          subject: "Your LessonLoop trial has ended",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a1a2e;">Hi ${escapeHtml(firstName)},</h1>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                Your 30-day LessonLoop trial has ended. Your account is now paused, 
                but <strong>your data is safe</strong>.
              </p>
              
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #166534; margin-top: 0;">✓ Good news:</h3>
                <p style="color: #444; font-size: 15px; line-height: 1.6; margin-bottom: 0;">
                  We're keeping all your data – students, invoices, schedules, and more – 
                  safe for the next 30 days. You can pick up right where you left off 
                  whenever you're ready.
                </p>
              </div>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                To restore access to your account and all your data, simply add a 
                payment method. It takes less than 2 minutes.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get('FRONTEND_URL') || 'https://lessonloop.net'}/settings?tab=billing" 
                   style="background: #14b8a6; color: white; padding: 14px 28px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold;
                          font-size: 16px;">
                  Restore My Account
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Questions or need help? Just reply to this email.
              </p>
              
              <p style="color: #444; font-size: 16px;">
                Best,<br>The LessonLoop Team
              </p>
            </div>
          `,
        });

        await supabase.from("message_log").insert({
          org_id: org.id,
          message_type: "trial_expired",
          channel: "email",
          recipient_email: profile.email,
          recipient_name: profile.full_name,
          subject: "Your LessonLoop trial has ended",
          body: "Trial expired notification email",
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        results.push({ orgId: org.id, status: "expired_and_notified" });
      } catch (emailError) {
        console.error(`Failed to send email for org ${org.id}:`, emailError);
        results.push({ orgId: org.id, status: "expired_email_failed", error: String(emailError) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Trial expired processing error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
