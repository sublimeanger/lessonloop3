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

    // Find orgs where trial ends tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfDay = new Date(tomorrow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: orgs, error: orgsError } = await supabase
      .from("organisations")
      .select("id, name, created_by")
      .eq("subscription_status", "trialing")
      .gte("trial_ends_at", startOfDay.toISOString())
      .lte("trial_ends_at", endOfDay.toISOString());

    if (orgsError) {
      throw orgsError;
    }

    console.log(`Found ${orgs?.length || 0} orgs with 1 day remaining`);

    const results = [];
    for (const org of orgs || []) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", org.created_by)
        .single();

      if (!profile?.email) continue;

      const firstName = profile.full_name?.split(" ")[0] || "there";

      try {
        await resend.emails.send({
          from: "LessonLoop <hello@lessonloop.net>",
          to: [profile.email],
          subject: "🚨 Final day of your LessonLoop trial",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #dc2626;">Last chance, ${escapeHtml(firstName)}!</h1>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                Your LessonLoop trial ends <strong>tomorrow</strong>. 
                After that, you'll lose access to your account.
              </p>
              
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #dc2626; margin-top: 0;">⚠️ What happens if you don't upgrade:</h3>
                <ul style="color: #444; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>You won't be able to access your student records</li>
                  <li>You won't be able to create or send invoices</li>
                  <li>Your calendar and schedule will be locked</li>
                  <li>Parents won't be able to access the portal</li>
                </ul>
                <p style="color: #666; font-size: 14px; margin-bottom: 0;">
                  <em>Don't worry – your data is safe! We keep it for 30 days so you can 
                  pick up right where you left off.</em>
                </p>
              </div>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                It only takes 2 minutes to add a payment method and continue using LessonLoop.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.lessonloop.net/settings?tab=billing" 
                   style="background: #dc2626; color: white; padding: 14px 28px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold;
                          font-size: 16px;">
                  Upgrade Now – Keep Your Data
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Need more time? Reply to this email and let us know – 
                we're happy to extend your trial if you're still evaluating.
              </p>
              
              <p style="color: #444; font-size: 16px;">
                Best,<br>The LessonLoop Team
              </p>
            </div>
          `,
        });

        await supabase.from("message_log").insert({
          org_id: org.id,
          message_type: "trial_reminder",
          channel: "email",
          recipient_email: profile.email,
          recipient_name: profile.full_name,
          subject: "Final day of your LessonLoop trial",
          body: "1-day trial reminder email",
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        results.push({ orgId: org.id, status: "sent" });
      } catch (emailError) {
        console.error(`Failed to send email for org ${org.id}:`, emailError);
        results.push({ orgId: org.id, status: "failed", error: String(emailError) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Trial reminder 1-day error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
