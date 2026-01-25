import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find orgs where trial ends in exactly 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const startOfDay = new Date(threeDaysFromNow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(threeDaysFromNow);
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

    console.log(`Found ${orgs?.length || 0} orgs with 3 days remaining`);

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
          from: "LessonLoop <hello@lessonloop.com>",
          to: [profile.email],
          subject: "⏰ Your trial ends in 3 days",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a1a2e;">Hi ${firstName},</h1>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                Your LessonLoop trial ends in <strong>3 days</strong>. 
                Don't lose access to your student records, invoices, and schedule!
              </p>
              
              <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #1a1a2e; margin-top: 0;">What you'll keep with a subscription:</h3>
                <ul style="color: #444; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>All your student profiles and lesson history</li>
                  <li>Your invoice records and payment tracking</li>
                  <li>Your calendar and recurring schedules</li>
                  <li>Practice logs and parent portal access</li>
                  <li>LoopAssist AI to help with admin tasks</li>
                </ul>
              </div>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                Plans start from just <strong>£12/month</strong> – less than the cost of 
                one lesson, to manage your entire teaching business.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://lessonloop.app/settings?tab=billing" 
                   style="background: #14b8a6; color: white; padding: 14px 28px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold;
                          font-size: 16px;">
                  Upgrade Now
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Have questions about which plan is right for you? 
                Reply to this email and we'll help you decide.
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
          subject: "Your trial ends in 3 days",
          body: "3-day trial reminder email",
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
    console.error("Trial reminder 3-day error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
