import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sanitiseFromName } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";
import { validateCronAuth } from "../_shared/cron-auth.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";
const MAX_ORGS_PER_RUN = 50;

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    let remindersSent = 0;
    let pushSent = 0;
    const errors: string[] = [];

    console.log("Starting lesson reminder check...");

    // 1. Query orgs with lesson reminders enabled
    const { data: orgs, error: orgsError } = await supabase
      .from("organisations")
      .select("id, name, timezone, logo_url, brand_primary_color, reminder_lesson_hours")
      .eq("reminder_lesson_enabled", true)
      .limit(MAX_ORGS_PER_RUN);

    if (orgsError) {
      throw new Error(`Failed to fetch organisations: ${orgsError.message}`);
    }

    if (!orgs?.length) {
      console.log("No organisations with lesson reminders enabled.");
      return jsonResponse({ success: true, sent: 0 });
    }

    console.log(`Processing ${orgs.length} organisation(s)...`);

    for (const org of orgs) {
      try {
        const result = await processOrg(supabase, org, now, resendApiKey);
        remindersSent += result.sent;
        pushSent += result.push;
        if (result.errors.length) errors.push(...result.errors);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Org ${org.id}: ${msg}`);
      }
    }

    console.log(`Lesson reminder job complete. Emails sent: ${remindersSent}, Push sent: ${pushSent}, Errors: ${errors.length}`);

    return jsonResponse({
      success: true,
      sent: remindersSent,
      push: pushSent,
      orgs_processed: orgs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error("Lesson reminders error:", error);
    return jsonResponse({ error: "An internal error occurred. Please try again." }, 500);
  }
});

// ── HELPERS ────────────────────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface Org {
  id: string;
  name: string;
  timezone: string | null;
  logo_url: string | null;
  brand_primary_color: string | null;
  reminder_lesson_hours: number | null;
}

// deno-lint-ignore no-explicit-any
async function processOrg(supabase: any, org: Org, now: Date, resendApiKey: string | undefined) {
  const reminderHours = org.reminder_lesson_hours ?? 24;
  const tz = org.timezone || "Europe/London";

  // Window: from now until reminderHours from now
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + reminderHours * 60 * 60 * 1000).toISOString();

  // 2. Find lessons starting within the reminder window
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select(`
      id, title, start_at, end_at, org_id,
      location:locations(name),
      room:rooms(name),
      teacher:teachers(display_name),
      lesson_participants(
        student:students!inner(
          id, first_name, last_name, deleted_at,
          student_guardians(
            guardian:guardians!inner(id, full_name, email, user_id, deleted_at)
          )
        )
      )
    `)
    .eq("org_id", org.id)
    .neq("status", "cancelled")
    .gte("start_at", windowStart)
    .lte("start_at", windowEnd);

  if (lessonsError) {
    throw new Error(`Failed to fetch lessons for org ${org.id}: ${lessonsError.message}`);
  }

  let sent = 0;
  let push = 0;
  const errors: string[] = [];

  for (const lesson of lessons || []) {
    try {
      // 3. Check if reminder already sent in last 48 hours
      const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("message_log")
        .select("id")
        .eq("related_id", lesson.id)
        .eq("message_type", "lesson_reminder")
        .gte("created_at", cutoff48h)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // 4. Collect unique guardians across all participants
      const guardianMap = new Map<string, { guardian: Guardian; students: string[] }>();

      for (const participant of lesson.lesson_participants || []) {
        const student = participant.student;
        if (!student || student.deleted_at) continue;
        const studentName = `${student.first_name} ${student.last_name}`;

        for (const sg of student.student_guardians || []) {
          const guardian = sg.guardian;
          if (!guardian || !guardian.email || guardian.deleted_at) continue;

          if (guardianMap.has(guardian.id)) {
            guardianMap.get(guardian.id)!.students.push(studentName);
          } else {
            guardianMap.set(guardian.id, { guardian, students: [studentName] });
          }
        }
      }

      // 5. Send one email per guardian per lesson
      for (const [, { guardian, students }] of guardianMap) {
        try {
          // Check notification preference
          if (guardian.user_id) {
            const enabled = await isNotificationEnabled(supabase, org.id, guardian.user_id, "email_lesson_reminders");
            if (!enabled) {
              console.log(`Guardian ${guardian.id} has lesson reminders disabled, skipping`);
              continue;
            }
          }

          const { subject, html } = buildEmail(org, lesson, guardian, students, tz);

          const emailSent = await logAndSend(supabase, resendApiKey, {
            orgId: org.id,
            orgName: org.name,
            subject,
            html,
            recipientEmail: guardian.email,
            recipientName: guardian.full_name,
            guardianId: guardian.id,
            relatedId: lesson.id,
            messageType: "lesson_reminder",
          });

          if (emailSent) sent++;

          // 7. Send push notification if guardian has portal access
          if (guardian.user_id) {
            try {
              const pushResult = await sendPush(supabase, {
                userId: guardian.user_id,
                title: `Lesson reminder`,
                body: `${students[0]} has ${escapeHtml(lesson.title)} ${formatRelativeTime(lesson.start_at, tz)}`,
                data: { type: "lesson_reminder", lessonId: lesson.id },
              });
              if (pushResult) push++;
            } catch (pushErr) {
              // Push failure should not block email delivery
              console.error(`Push notification failed for guardian ${guardian.id}:`, pushErr);
            }
          }
        } catch (guardianErr: unknown) {
          const msg = guardianErr instanceof Error ? guardianErr.message : String(guardianErr);
          errors.push(`Lesson ${lesson.id}, guardian ${guardian.id}: ${msg}`);
        }
      }
    } catch (lessonErr: unknown) {
      const msg = lessonErr instanceof Error ? lessonErr.message : String(lessonErr);
      errors.push(`Lesson ${lesson.id}: ${msg}`);
    }
  }

  return { sent, push, errors };
}

// ── EMAIL BUILDING ────────────────────────────────────────

interface Guardian {
  id: string;
  full_name: string;
  email: string;
  user_id: string | null;
  deleted_at: string | null;
}

interface Lesson {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  org_id: string;
  location: { name: string } | null;
  room: { name: string } | null;
  teacher: { display_name: string } | null;
}

function formatDateTime(isoStr: string, tz: string): { date: string; time: string } {
  const dt = new Date(isoStr);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(dt);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(dt);
  return { date, time };
}

function formatRelativeTime(isoStr: string, tz: string): string {
  const { time } = formatDateTime(isoStr, tz);
  return `tomorrow at ${time}`;
}

function buildBrandedHeader(orgName: string, logoUrl: string | null, brandColor: string): string {
  return logoUrl
    ? `<div style="border-bottom: 3px solid ${brandColor}; padding-bottom: 16px; margin-bottom: 20px;">
        <img src="${logoUrl}" alt="${escapeHtml(orgName)}" style="max-height: 60px;" />
      </div>`
    : `<div style="border-bottom: 3px solid ${brandColor}; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: ${brandColor};">${escapeHtml(orgName)}</h2>
      </div>`;
}

function buildEmail(
  org: Org,
  lesson: Lesson,
  guardian: Guardian,
  studentNames: string[],
  tz: string
): { subject: string; html: string } {
  const { date, time } = formatDateTime(lesson.start_at, tz);
  const brandColor = org.brand_primary_color || "#2563eb";

  const subject = `Lesson reminder \u2014 ${lesson.title} tomorrow at ${time}`;

  const locationLine = lesson.location?.name
    ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${escapeHtml(lesson.location.name)}</p>`
    : "";
  const roomLine = lesson.room?.name
    ? `<p style="margin: 5px 0;"><strong>Room:</strong> ${escapeHtml(lesson.room.name)}</p>`
    : "";
  const teacherLine = lesson.teacher?.display_name
    ? `<p style="margin: 5px 0;"><strong>Teacher:</strong> ${escapeHtml(lesson.teacher.display_name)}</p>`
    : "";
  const studentLine = studentNames.map((n) => escapeHtml(n)).join(", ");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${buildBrandedHeader(org.name, org.logo_url, brandColor)}
      <h1 style="color: #333; margin-bottom: 20px;">Lesson Reminder</h1>
      <p>Dear ${escapeHtml(guardian.full_name)},</p>
      <p>This is a friendly reminder about an upcoming lesson for <strong>${studentLine}</strong>.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${brandColor};">
        <p style="margin: 5px 0;"><strong>Lesson:</strong> ${escapeHtml(lesson.title)}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${escapeHtml(date)}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${escapeHtml(time)}</p>
        ${locationLine}
        ${roomLine}
        ${teacherLine}
      </div>
      <p>If you need to make any changes, please contact ${escapeHtml(org.name)}.</p>
      <p>Thank you,<br>${escapeHtml(org.name)}</p>
    </div>`;

  return { subject, html };
}

// ── SEND HELPERS ──────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function logAndSend(
  supabase: any,
  resendApiKey: string | undefined,
  opts: {
    orgId: string;
    orgName: string;
    subject: string;
    html: string;
    recipientEmail: string;
    recipientName: string;
    guardianId: string;
    relatedId: string;
    messageType: string;
  }
): Promise<boolean> {
  const status = resendApiKey ? "pending" : "logged";

  const { error: logError } = await supabase.from("message_log").insert({
    org_id: opts.orgId,
    channel: "email",
    subject: opts.subject,
    body: opts.html,
    sender_user_id: null,
    recipient_email: opts.recipientEmail,
    recipient_name: opts.recipientName,
    recipient_type: "guardian",
    recipient_id: opts.guardianId,
    related_id: opts.relatedId,
    message_type: opts.messageType,
    status,
  });

  if (logError) console.error("Failed to log message:", logError);

  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${sanitiseFromName(opts.orgName)} <notifications@lessonloop.net>`,
        to: [opts.recipientEmail],
        subject: opts.subject,
        html: opts.html,
        headers: {
          "List-Unsubscribe": `<${FRONTEND_URL}/portal/settings?tab=notifications>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    const result = await response.json();

    await supabase
      .from("message_log")
      .update({
        status: response.ok ? "sent" : "failed",
        sent_at: response.ok ? new Date().toISOString() : null,
        error_message: response.ok ? null : JSON.stringify(result),
      })
      .eq("related_id", opts.relatedId)
      .eq("message_type", opts.messageType)
      .eq("recipient_id", opts.guardianId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!response.ok) {
      console.error(`Email send failed for ${opts.recipientEmail}:`, result);
      return false;
    }
  }

  return true;
}

// deno-lint-ignore no-explicit-any
async function sendPush(
  supabase: any,
  payload: { userId: string; title: string; body: string; data?: Record<string, string> }
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Push invoke failed:`, text);
    return false;
  }

  const result = await response.json();
  return result.sent === true;
}
