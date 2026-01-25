import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface StreakMilestone {
  streak: number;
  title: string;
  message: string;
  emoji: string;
}

const MILESTONES: StreakMilestone[] = [
  { streak: 3, title: "Building Momentum!", message: "3 days in a row - you're building great habits!", emoji: "⚡" },
  { streak: 7, title: "One Week Strong!", message: "A full week of practice - amazing dedication!", emoji: "🔥" },
  { streak: 14, title: "Two Week Champion!", message: "14 days of consistent practice - you're on fire!", emoji: "🌟" },
  { streak: 30, title: "Monthly Master!", message: "30 days of practice - legendary commitment!", emoji: "🏆" },
  { streak: 60, title: "60 Day Superstar!", message: "Two months of dedication - incredible!", emoji: "💫" },
  { streak: 100, title: "Century Club!", message: "100 days of practice - truly exceptional!", emoji: "👑" },
];

function getMilestone(streak: number): StreakMilestone | null {
  return MILESTONES.find(m => m.streak === streak) || null;
}

async function sendStreakEmail(
  recipientEmail: string,
  recipientName: string,
  studentName: string,
  milestone: StreakMilestone,
  orgName: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log("RESEND_API_KEY not configured, skipping email");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${orgName} <notifications@lessonloop.net>`,
        to: [recipientEmail],
        subject: `${milestone.emoji} ${studentName} hit a ${milestone.streak}-day streak!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f97316;">${milestone.emoji} ${milestone.title}</h1>
            <p>Hi ${recipientName},</p>
            <p><strong>${studentName}</strong> just achieved a <strong>${milestone.streak}-day practice streak</strong>!</p>
            <p style="font-size: 18px; color: #374151; background: #fef3c7; padding: 16px; border-radius: 8px;">
              ${milestone.message}
            </p>
            <p>Keep up the great work! Consistent practice is the key to musical growth.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
              — The ${orgName} Team
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { student_id, new_streak, org_id } = await req.json();

    if (!student_id || !new_streak || !org_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers }
      );
    }

    // Check if this is a milestone streak
    const milestone = getMilestone(new_streak);
    if (!milestone) {
      return new Response(
        JSON.stringify({ message: "Not a milestone streak", streak: new_streak }),
        { status: 200, headers }
      );
    }

    // Get student info
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("first_name, last_name")
      .eq("id", student_id)
      .single();

    if (studentError || !student) {
      throw new Error("Student not found");
    }

    const studentName = `${student.first_name} ${student.last_name}`;

    // Get org info
    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", org_id)
      .single();

    if (orgError || !org) {
      throw new Error("Organisation not found");
    }

    // Get guardians to notify
    const { data: guardians, error: guardianError } = await supabase
      .from("student_guardians")
      .select(`
        guardians:guardian_id (
          id,
          full_name,
          email
        )
      `)
      .eq("student_id", student_id);

    if (guardianError) {
      console.error("Error fetching guardians:", guardianError);
    }

    let emailsSent = 0;

    // Send emails to guardians
    for (const sg of guardians || []) {
      const guardian = sg.guardians as any;
      if (guardian?.email) {
        const sent = await sendStreakEmail(
          guardian.email,
          guardian.full_name || "there",
          studentName,
          milestone,
          org.name
        );
        if (sent) emailsSent++;
      }
    }

    // Log the notification
    if (emailsSent > 0) {
      await supabase.from("message_log").insert({
        org_id,
        message_type: "streak_notification",
        channel: "email",
        subject: `${studentName} hit a ${new_streak}-day streak!`,
        body: milestone.message,
        recipient_email: (guardians || []).map((g: any) => g.guardians?.email).filter(Boolean).join(", "),
        recipient_name: studentName,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        milestone: milestone.title,
        streak: new_streak,
        emails_sent: emailsSent,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
