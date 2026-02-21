import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronAuth } from "../_shared/cron-auth.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://lessonloop.net";

Deno.serve(async (req) => {
  // Only allow scheduled/internal calls
  const authError = validateCronAuth(req);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find connections expiring within 7 days that haven't already expired
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: expiring, error } = await supabase
      .from("calendar_connections")
      .select("id, user_id, org_id, ical_token_expires_at")
      .eq("provider", "apple")
      .eq("sync_enabled", true)
      .not("ical_token", "is", null)
      .not("ical_token_expires_at", "is", null)
      .gt("ical_token_expires_at", now.toISOString())
      .lte("ical_token_expires_at", sevenDaysFromNow.toISOString());

    if (error) {
      console.error("Error fetching expiring connections:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!expiring || expiring.length === 0) {
      return new Response(JSON.stringify({ message: "No expiring tokens found", sent: 0 }));
    }

    let sent = 0;

    for (const conn of expiring) {
      // Get user profile for email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", conn.user_id)
        .single();

      if (!profile?.email) continue;

      const expiresAt = new Date(conn.ical_token_expires_at);
      const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const expiryDate = expiresAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      // Get org name
      const { data: org } = await supabase
        .from("organisations")
        .select("name")
        .eq("id", conn.org_id)
        .single();

      const orgName = org?.name || "LessonLoop";
      const userName = profile.full_name || "there";

      const subject = `Your LessonLoop calendar feed expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Calendar Feed Expiring Soon</h2>
          <p>Hi ${escapeHtml(userName)},</p>
          <p>Your Apple Calendar (iCal) feed for <strong>${escapeHtml(orgName)}</strong> will expire on <strong>${escapeHtml(expiryDate)}</strong>.</p>
          <p>To keep your lessons syncing, please regenerate your feed URL in LessonLoop settings and re-subscribe in your calendar app.</p>
          <div style="margin: 24px 0;">
            <a href="${FRONTEND_URL}/settings?tab=calendar"
               style="background-color: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Regenerate Feed URL
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">If you no longer use this calendar feed, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Sent by LessonLoop</p>
        </div>
      `;

      // Send via Resend if configured, otherwise log
      if (resendApiKey) {
        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "LessonLoop <notifications@lessonloop.app>",
              to: [profile.email],
              subject,
              html,
            }),
          });

          if (emailRes.ok) {
            sent++;
            console.log(`Sent iCal expiry reminder to ${profile.email}`);
          } else {
            const errText = await emailRes.text();
            console.error(`Failed to send to ${profile.email}:`, errText);
          }
        } catch (emailErr) {
          console.error(`Error sending to ${profile.email}:`, emailErr);
        }
      } else {
        console.log(`[DRY RUN] Would send iCal expiry reminder to ${profile.email} — expires ${expiryDate}`);
        sent++;
      }
    }

    return new Response(JSON.stringify({ message: "Done", sent, total: expiring.length }));
  } catch (err) {
    console.error("iCal expiry reminder error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
