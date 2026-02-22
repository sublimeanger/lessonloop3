import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://lessonloop3.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Auth check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { waitlist_id } = await req.json();
    if (!waitlist_id) {
      return new Response(JSON.stringify({ error: "waitlist_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch waitlist entry via user-scoped client (RLS enforces org access)
    const { data: waitlistCheck, error: waitlistCheckError } = await userClient
      .from("make_up_waitlist")
      .select("id, org_id")
      .eq("id", waitlist_id)
      .single();

    if (waitlistCheckError || !waitlistCheck) {
      return new Response(JSON.stringify({ error: "Waitlist entry not found or no access" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin/owner of this org
    const { data: membership, error: membershipError } = await userClient
      .from("org_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", waitlistCheck.org_id)
      .in("role", ["owner", "admin"])
      .eq("status", "active")
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Authorised: proceed with service-role client ---
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch waitlist entry with joins
    const { data: entry, error: entryError } = await supabase
      .from("make_up_waitlist")
      .select(`
        *,
        students!make_up_waitlist_student_id_fkey (first_name, last_name),
        guardians!make_up_waitlist_guardian_id_fkey (id, full_name, email, user_id),
        matched_lesson:lessons!make_up_waitlist_matched_lesson_id_fkey (
          id, title, start_at, end_at,
          locations!lessons_location_id_fkey (name),
          teachers!lessons_teacher_id_fkey (display_name)
        )
      `)
      .eq("id", waitlist_id)
      .single();

    if (entryError || !entry) {
      console.error("Failed to fetch waitlist entry:", entryError);
      return new Response(JSON.stringify({ error: "Entry not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guardian = entry.guardians as { id: string; full_name: string; email: string; user_id: string | null } | null;
    if (!guardian?.email) {
      console.log("No guardian email for waitlist", waitlist_id);
      return new Response(JSON.stringify({ skipped: true, reason: "no_guardian_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check notification preference before sending
    if (guardian.user_id) {
      const enabled = await isNotificationEnabled(supabase, entry.org_id, guardian.user_id, "email_makeup_offers");
      if (!enabled) {
        console.log(`Guardian ${guardian.id} has makeup offer emails disabled`);
        return new Response(JSON.stringify({ skipped: true, reason: "notification_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get org name
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", entry.org_id)
      .single();

    const orgName = org?.name || "LessonLoop";
    const student = entry.students as { first_name: string; last_name: string } | null;
    const studentFirst = student?.first_name || "your child";
    const studentName = `${student?.first_name || ""} ${student?.last_name || ""}`.trim();
    const matched = entry.matched_lesson as {
      id: string; title: string; start_at: string; end_at: string;
      locations: { name: string } | null;
      teachers: { display_name: string } | null;
    } | null;

    // Format lesson details
    const lessonTitle = matched?.title || entry.lesson_title;
    const lessonDate = matched?.start_at
      ? new Date(matched.start_at).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : "TBC";
    const lessonTime = matched?.start_at
      ? new Date(matched.start_at).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "TBC";
    const lessonEnd = matched?.end_at
      ? new Date(matched.end_at).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const teacher = matched?.teachers?.display_name || "their teacher";
    const location = matched?.locations?.name || "the usual location";

    const missedDate = new Date(entry.missed_lesson_date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
    });

    const acceptUrl = `${FRONTEND_URL}/portal/home?makeup_action=accept&id=${waitlist_id}`;
    const declineUrl = `${FRONTEND_URL}/portal/home?makeup_action=decline&id=${waitlist_id}`;

    const subject = `Make-up lesson available for ${escapeHtml(studentFirst)}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #1a1a1a;">Make-Up Lesson Available</h2>
        <p>Hi ${escapeHtml(guardian.full_name || "there")},</p>
        <p>Great news! A make-up slot is available for <strong>${escapeHtml(studentName)}</strong>, who missed <em>${escapeHtml(entry.lesson_title)}</em> on ${escapeHtml(missedDate)}.</p>

        <div style="border: 2px solid #22c55e; border-radius: 8px; padding: 16px; margin: 24px 0; background-color: #f0fdf4;">
          <h3 style="margin: 0 0 12px 0; color: #15803d;">📅 Offered Lesson</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
            <tr><td style="padding: 4px 8px; color: #666; width: 90px;">Lesson</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(lessonTitle)}</td></tr>
            <tr><td style="padding: 4px 8px; color: #666;">Date</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(lessonDate)}</td></tr>
            <tr><td style="padding: 4px 8px; color: #666;">Time</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(lessonTime)}${lessonEnd ? ` – ${escapeHtml(lessonEnd)}` : ""}</td></tr>
            <tr><td style="padding: 4px 8px; color: #666;">Teacher</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(teacher)}</td></tr>
            <tr><td style="padding: 4px 8px; color: #666;">Location</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(location)}</td></tr>
          </table>
        </div>

        <div style="margin: 24px 0; text-align: center;">
          <a href="${acceptUrl}"
             style="background-color: #22c55e; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600; font-size: 16px; margin-right: 12px;">
            ✅ Accept This Slot
          </a>
          <a href="${declineUrl}"
             style="background-color: #e5e7eb; color: #374151; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600; font-size: 16px;">
            Decline
          </a>
        </div>

        <p style="color: #666; font-size: 14px; text-align: center; margin-top: 8px;">
          ⏰ Please respond within <strong>48 hours</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">Sent by ${escapeHtml(orgName)} via LessonLoop</p>
      </div>
    `;

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

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
            to: [guardian.email],
            subject,
            html,
          }),
        });

        if (emailRes.ok) {
          emailSent = true;
          console.log(`Sent make-up offer email to ${guardian.email}`);
        } else {
          const errText = await emailRes.text();
          console.error(`Failed to send email to ${guardian.email}:`, errText);
        }
      } catch (emailErr) {
        console.error(`Error sending email to ${guardian.email}:`, emailErr);
      }
    } else {
      console.log(`[DRY RUN] Would send make-up offer to ${guardian.email}`);
    }

    // Log to message_log
    const { error: logError } = await supabase.from("message_log").insert({
      org_id: entry.org_id,
      message_type: "makeup_offer",
      channel: "email",
      subject,
      body: `Make-up offer for ${studentName}: ${lessonTitle} on ${lessonDate} at ${lessonTime}`,
      recipient_email: guardian.email,
      recipient_name: guardian.full_name || "",
      recipient_id: guardian.id,
      recipient_type: "guardian",
      related_id: waitlist_id,
      status: emailSent ? "sent" : "failed",
      sent_at: emailSent ? new Date().toISOString() : null,
    });

    if (logError) {
      console.error("Failed to log message:", logError);
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: emailSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-makeup-offer error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
