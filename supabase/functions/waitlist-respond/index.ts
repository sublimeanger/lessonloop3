import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

function htmlPage(title: string, message: string, isSuccess: boolean): string {
  const color = isSuccess ? "#16a34a" : "#6b7280";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — LessonLoop</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .icon { width: 48px; height: 48px; border-radius: 50%; background: ${color}15; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
    .icon svg { width: 24px; height: 24px; color: ${color}; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #1a1a1a; }
    p { color: #6b7280; font-size: 15px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        ${isSuccess
          ? '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />'
          : '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />'
        }
      </svg>
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const action = url.searchParams.get("action");

    if (!token || !action || !["accept", "decline"].includes(action)) {
      return new Response(
        htmlPage("Invalid Link", "This link is invalid or malformed. Please contact the academy.", false),
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwtSecret = Deno.env.get("WAITLIST_JWT_SECRET") || supabaseServiceKey;

    // 1. Verify JWT
    const secret = new TextEncoder().encode(jwtSecret);
    let payload: jose.JWTPayload;
    try {
      const { payload: p } = await jose.jwtVerify(token, secret);
      payload = p;
    } catch {
      return new Response(
        htmlPage("Link Expired", "This offer has expired. Please contact the academy for more information.", false),
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    const waitlistId = payload.waitlist_id as string;
    const orgId = payload.org_id as string;

    if (!waitlistId || !orgId) {
      return new Response(
        htmlPage("Invalid Link", "This link is invalid. Please contact the academy.", false),
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch entry, verify status
    const { data: entry, error: fetchError } = await supabaseService
      .from("enrolment_waitlist")
      .select("id, status, child_first_name, instrument_name, contact_name")
      .eq("id", waitlistId)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !entry) {
      return new Response(
        htmlPage("Not Found", "We couldn't find this waitlist entry. Please contact the academy.", false),
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    if (entry.status !== "offered") {
      // Already responded
      const already =
        entry.status === "accepted"
          ? "You've already accepted this offer."
          : entry.status === "declined"
          ? "You've already declined this offer."
          : "This offer is no longer active.";
      return new Response(
        htmlPage("Already Responded", already + " Please contact the academy if you have questions.", false),
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }

    // 3. Process action
    const newStatus = action === "accept" ? "accepted" : "declined";
    const { error: updateError } = await supabaseService
      .from("enrolment_waitlist")
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
      })
      .eq("id", waitlistId)
      .eq("org_id", orgId);

    if (updateError) {
      console.error("Failed to update waitlist entry:", updateError);
      return new Response(
        htmlPage("Error", "Something went wrong. Please try again or contact the academy.", false),
        { status: 500, headers: { "Content-Type": "text/html" } }
      );
    }

    // 4. Log activity
    await supabaseService.from("enrolment_waitlist_activity").insert({
      org_id: orgId,
      waitlist_id: waitlistId,
      activity_type: newStatus,
      description:
        action === "accept"
          ? `${entry.contact_name} accepted the offer via email link`
          : `${entry.contact_name} declined the offer via email link`,
    });

    // 5. Return success page
    if (action === "accept") {
      return new Response(
        htmlPage(
          "Offer Accepted!",
          `Thank you! We're delighted that ${entry.child_first_name} will be joining us for ${entry.instrument_name} lessons. The academy will be in touch shortly to complete your enrolment.`,
          true
        ),
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response(
      htmlPage(
        "Thanks for Letting Us Know",
        `We understand this slot wasn't right for ${entry.child_first_name}. We'll keep you on the waiting list and let you know when another slot becomes available.`,
        false
      ),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("waitlist-respond error:", error);
    return new Response(
      htmlPage("Error", "Something went wrong. Please contact the academy.", false),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
};

serve(handler);
