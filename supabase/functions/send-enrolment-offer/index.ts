import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

interface SendOfferRequest {
  waitlist_id: string;
  org_id: string;
}

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const jwtSecret = Deno.env.get("WAITLIST_JWT_SECRET") || supabaseServiceKey;

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

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SendOfferRequest = await req.json();
    const { waitlist_id, org_id } = body;

    if (!waitlist_id || !org_id) {
      return new Response(JSON.stringify({ error: "waitlist_id and org_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for writes
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch waitlist entry
    const { data: entry, error: entryError } = await supabaseService
      .from("enrolment_waitlist")
      .select("*")
      .eq("id", waitlist_id)
      .eq("org_id", org_id)
      .single();

    if (entryError || !entry) {
      return new Response(JSON.stringify({ error: "Waitlist entry not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!entry.contact_email) {
      return new Response(JSON.stringify({ error: "No contact email on waitlist entry" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch org
    const { data: org } = await supabaseService
      .from("organisations")
      .select("name, logo_url, accent_color, terms_conditions_url, enrolment_offer_expiry_hours")
      .eq("id", org_id)
      .single();

    const orgName = org?.name || "Music Academy";
    const termsUrl = org?.terms_conditions_url;

    // 3. Fetch offered teacher name
    let teacherName = "Your teacher";
    if (entry.offered_teacher_id) {
      const { data: teacher } = await supabaseService
        .from("teachers")
        .select("display_name")
        .eq("id", entry.offered_teacher_id)
        .single();
      if (teacher) teacherName = teacher.display_name;
    }

    // 4. Fetch offered location name
    let locationName = "";
    if (entry.offered_location_id) {
      const { data: location } = await supabaseService
        .from("locations")
        .select("name")
        .eq("id", entry.offered_location_id)
        .single();
      if (location) locationName = location.name;
    }

    // 5. Calculate term fee (rate × remaining weeks)
    let termFeeDisplay = "";
    if (entry.offered_rate_minor) {
      // Try to find current term
      const today = new Date().toISOString().split("T")[0];
      const { data: currentTerm } = await supabaseService
        .from("terms")
        .select("start_date, end_date")
        .eq("org_id", org_id)
        .lte("start_date", today)
        .gte("end_date", today)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentTerm) {
        // Count weeks from now to term end
        const now = new Date();
        const termEnd = new Date(currentTerm.end_date);
        const weeksRemaining = Math.max(
          1,
          Math.ceil((termEnd.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))
        );
        const totalFeePence = entry.offered_rate_minor * weeksRemaining;
        termFeeDisplay = `Estimated term fee: £${(totalFeePence / 100).toFixed(2)} (${weeksRemaining} weeks × £${(entry.offered_rate_minor / 100).toFixed(2)})`;
      } else {
        termFeeDisplay = `Lesson rate: £${(entry.offered_rate_minor / 100).toFixed(2)} per lesson`;
      }
    }

    // 6. Create signed JWT for accept/decline links
    const secret = new TextEncoder().encode(jwtSecret);
    const expiresAt = entry.offer_expires_at
      ? new Date(entry.offer_expires_at)
      : new Date(Date.now() + 48 * 60 * 60 * 1000);

    const acceptToken = await new jose.SignJWT({
      waitlist_id,
      org_id,
      action: "accept",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(secret);

    const declineToken = await new jose.SignJWT({
      waitlist_id,
      org_id,
      action: "decline",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(secret);

    const respondBaseUrl = `${supabaseUrl}/functions/v1/waitlist-respond`;
    const acceptUrl = `${respondBaseUrl}?token=${acceptToken}&action=accept`;
    const declineUrl = `${respondBaseUrl}?token=${declineToken}&action=decline`;

    const dayLabel = DAY_LABELS[entry.offered_slot_day] || entry.offered_slot_day || "";
    const timeLabel = entry.offered_slot_time || "";

    // 7. Build email HTML
    const subject = `Lesson Slot Available — ${escapeHtml(entry.instrument_name)} for ${escapeHtml(entry.child_first_name)}`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Great news!</h2>
        <p>A lesson slot has become available for <strong>${escapeHtml(entry.child_first_name)}</strong> at <strong>${escapeHtml(orgName)}</strong>.</p>

        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 8px; color: #666;">Instrument</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(entry.instrument_name)}</td></tr>
            <tr><td style="padding: 4px 8px; color: #666;">Day</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(dayLabel)}</td></tr>
            <tr><td style="padding: 4px 8px; color: #666;">Time</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(timeLabel)}</td></tr>
            <tr><td style="padding: 4px 8px; color: #666;">Teacher</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(teacherName)}</td></tr>
            ${locationName ? `<tr><td style="padding: 4px 8px; color: #666;">Location</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(locationName)}</td></tr>` : ""}
            ${termFeeDisplay ? `<tr><td style="padding: 4px 8px; color: #666;">Fee</td><td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(termFeeDisplay)}</td></tr>` : ""}
          </table>
        </div>

        <p>This slot is being held for you until <strong>${expiresAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</strong>. Please respond before then.</p>

        <div style="margin: 24px 0; text-align: center;">
          <a href="${acceptUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-right: 12px;">Accept Slot</a>
          <a href="${declineUrl}" style="display: inline-block; background: #e5e7eb; color: #374151; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Decline</a>
        </div>

        ${termsUrl ? `<p style="font-size: 13px; color: #888;">By accepting, you agree to our <a href="${escapeHtml(termsUrl)}" style="color: #2563eb;">Terms & Conditions</a>.</p>` : ""}

        <p style="margin-top: 24px;">Thank you,<br>${escapeHtml(orgName)}</p>
      </div>`;

    // 8. Log to message_log
    await supabaseService.from("message_log").insert({
      org_id,
      channel: "email",
      subject,
      body: htmlContent,
      sender_user_id: user.id,
      recipient_email: entry.contact_email,
      recipient_name: entry.contact_name,
      recipient_type: "guardian",
      related_id: waitlist_id,
      message_type: "enrolment_offer",
      status: resendApiKey ? "pending" : "logged",
    });

    // 9. Send via Resend
    if (!resendApiKey) {
      console.log("Email logged (RESEND_API_KEY not configured):", {
        to: entry.contact_email,
        subject,
      });
    } else {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${orgName} <notifications@lessonloop.net>`,
          to: [entry.contact_email],
          subject,
          html: htmlContent,
        }),
      });

      const result = await response.json();
      console.log("Enrolment offer email sent:", result);

      // Update message_log status
      await supabaseService
        .from("message_log")
        .update({
          status: response.ok ? "sent" : "failed",
          sent_at: response.ok ? new Date().toISOString() : null,
          error_message: response.ok ? null : JSON.stringify(result),
        })
        .eq("related_id", waitlist_id)
        .eq("message_type", "enrolment_offer")
        .order("created_at", { ascending: false })
        .limit(1);
    }

    // 10. Log activity
    await supabaseService.from("enrolment_waitlist_activity").insert({
      org_id,
      waitlist_id,
      activity_type: "offer_sent",
      description: `Offer email sent to ${entry.contact_email}`,
      metadata: {
        day: entry.offered_slot_day,
        time: entry.offered_slot_time,
        teacher_name: teacherName,
        expires_at: expiresAt.toISOString(),
      },
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Offer email sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-enrolment-offer error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
