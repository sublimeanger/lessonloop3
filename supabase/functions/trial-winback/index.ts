import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
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

    // Find orgs where trial expired 3 days ago and still cancelled
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const startOfDay = new Date(threeDaysAgo);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(threeDaysAgo);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: orgs, error: orgsError } = await supabase
      .from("organisations")
      .select("id, name, created_by")
      .eq("subscription_status", "cancelled")
      .gte("trial_ends_at", startOfDay.toISOString())
      .lte("trial_ends_at", endOfDay.toISOString());

    if (orgsError) {
      throw orgsError;
    }

    console.log(`Found ${orgs?.length || 0} orgs for winback (3 days post-expiry)`);

    const results = [];
    for (const org of orgs || []) {
      // Check if we already sent a winback email
      const { data: existingWinback } = await supabase
        .from("message_log")
        .select("id")
        .eq("org_id", org.id)
        .eq("message_type", "trial_winback")
        .limit(1);

      if (existingWinback && existingWinback.length > 0) {
        console.log(`Winback already sent for org ${org.id}, skipping`);
        continue;
      }

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
          subject: "We miss you! Your LessonLoop data is waiting 💙",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a1a2e;">Hi ${firstName},</h1>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                It's been a few days since your LessonLoop trial ended. 
                We hope everything is going well with your teaching!
              </p>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                We wanted to let you know that <strong>all your data is still here</strong> – 
                your students, lessons, invoices, everything. It's ready and waiting 
                for when you want to pick up where you left off.
              </p>
              
              <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #7c3aed; margin-top: 0;">✨ Quick reminder of what you built:</h3>
                <p style="color: #444; font-size: 15px; line-height: 1.6; margin-bottom: 0;">
                  All those student profiles, lesson schedules, and invoice records 
                  you set up – they're all safely stored. One click and you're back in business.
                </p>
              </div>
              
              <p style="color: #444; font-size: 16px; line-height: 1.6;">
                If there's anything we could have done better during your trial, 
                or if you have feedback, we'd genuinely love to hear it. 
                Just reply to this email.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.lessonloop.net/settings?tab=billing" 
                   style="background: #7c3aed; color: white; padding: 14px 28px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold;
                          font-size: 16px;">
                  Come Back to LessonLoop
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                P.S. Your data will be kept for 30 days after your trial ended. 
                After that, it will be permanently deleted for privacy reasons.
              </p>
              
              <p style="color: #444; font-size: 16px;">
                All the best,<br>The LessonLoop Team
              </p>
            </div>
          `,
        });

        await supabase.from("message_log").insert({
          org_id: org.id,
          message_type: "trial_winback",
          channel: "email",
          recipient_email: profile.email,
          recipient_name: profile.full_name,
          subject: "We miss you! Your LessonLoop data is waiting",
          body: "Winback email 3 days after trial expiry",
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
    console.error("Trial winback error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
