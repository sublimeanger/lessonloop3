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

    // Find orgs where trial ends in exactly 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const startOfDay = new Date(sevenDaysFromNow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(sevenDaysFromNow);
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

    console.log(`Found ${orgs?.length || 0} orgs with 7 days remaining`);

    const results = [];
    for (const org of orgs || []) {
      // Get owner's email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", org.created_by)
        .single();

      if (!profile?.email) {
        console.log(`No email for org ${org.id}, skipping`);
        continue;
      }

      const firstName = profile.full_name?.split(" ")[0] || "there";

      try {
        await resend.emails.send({
          from: "LessonLoop <hello@lessonloop.net>",
          to: [profile.email],
          subject: "One week left in your LessonLoop trial! 🎵",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a1a2e;">Hi ${firstName}!</h1>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                You've been using LessonLoop for 3 weeks now – how's it going? 
                Your free trial ends in <strong>7 days</strong>.
              </p>
              
              <h2 style="color: #1a1a2e; font-size: 18px;">Here's what you might not have tried yet:</h2>
              <ul style="color: #444; font-size: 16px; line-height: 1.8;">
                <li>📊 Generate invoices in bulk with billing runs</li>
                <li>🎯 Ask LoopAssist AI to draft emails or summarize your week</li>
                <li>📱 Share the parent portal link with your students' families</li>
                <li>📅 Set up recurring lessons to save time</li>
              </ul>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                To keep your data and continue using LessonLoop after your trial, 
                just add a payment method in your settings.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://lessonloop.net/settings?tab=billing" 
                   style="background: #14b8a6; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Add Payment Method
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Questions? Just reply to this email – we're here to help!
              </p>
              
              <p style="color: #444; font-size: 16px;">
                Best,<br>The LessonLoop Team
              </p>
            </div>
          `,
        });

        // Log the message
        await supabase.from("message_log").insert({
          org_id: org.id,
          message_type: "trial_reminder",
          channel: "email",
          recipient_email: profile.email,
          recipient_name: profile.full_name,
          subject: "One week left in your LessonLoop trial!",
          body: "7-day trial reminder email",
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
    console.error("Trial reminder 7-day error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
