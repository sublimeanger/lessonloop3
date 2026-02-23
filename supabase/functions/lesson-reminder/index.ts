import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";
import { validateCronAuth } from "../_shared/cron-auth.ts";
import { maybeSendSms } from "../_shared/sms-helpers.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://lessonloop.net";

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Lessons starting between 23h and 25h from now (catches "tomorrow" with cron tolerance)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(
      `Checking for lessons between ${windowStart.toISOString()} and ${windowEnd.toISOString()}...`,
    );

    // Get lessons in the reminder window
    const { data: lessons, error: lessonError } = await supabase
      .from("lessons")
      .select(`
        id, title, start_time, end_time, org_id,
        organisation:organisations!inner(name),
        lesson_participants(
          student:students(
            id, first_name, last_name,
            student_guardians(
              guardian:guardians(id, full_name, email, phone, user_id, sms_opted_in)
            )
          )
        )
      `)
      .gte("start_time", windowStart.toISOString())
      .lte("start_time", windowEnd.toISOString())
      .eq("status", "scheduled");

    if (lessonError) {
      throw new Error(`Failed to fetch lessons: ${lessonError.message}`);
    }

    let emailsSent = 0;
    let smsSent = 0;
    const errors: string[] = [];

    for (const lesson of lessons || []) {
      try {
        const org = lesson.organisation as { name: string } | null;
        const orgName = org?.name || "LessonLoop";
        const lessonTime = new Date(lesson.start_time).toLocaleTimeString(
          "en-GB",
          { hour: "2-digit", minute: "2-digit" },
        );
        const lessonDate = new Date(lesson.start_time).toLocaleDateString(
          "en-GB",
          { weekday: "long", day: "numeric", month: "long" },
        );

        // Collect unique guardians across all participants
        const guardianMap = new Map<
          string,
          {
            id: string;
            full_name: string;
            email: string | null;
            phone: string | null;
            user_id: string | null;
            sms_opted_in: boolean;
            studentNames: string[];
          }
        >();

        for (const participant of lesson.lesson_participants || []) {
          const student = (participant as { student: unknown }).student as {
            id: string;
            first_name: string;
            last_name: string;
            student_guardians: { guardian: unknown }[];
          } | null;
          if (!student) continue;

          const studentName = `${student.first_name} ${student.last_name}`;

          for (const sg of student.student_guardians || []) {
            const guardian = sg.guardian as {
              id: string;
              full_name: string;
              email: string | null;
              phone: string | null;
              user_id: string | null;
              sms_opted_in: boolean;
            } | null;
            if (!guardian) continue;

            const existing = guardianMap.get(guardian.id);
            if (existing) {
              if (!existing.studentNames.includes(studentName)) {
                existing.studentNames.push(studentName);
              }
            } else {
              guardianMap.set(guardian.id, {
                ...guardian,
                studentNames: [studentName],
              });
            }
          }
        }

        for (const guardian of guardianMap.values()) {
          const studentNameList = guardian.studentNames.join(" & ");
          const portalLink = `${FRONTEND_URL}/portal/schedule`;

          // ── Deduplication check ──
          const { data: existing } = await supabase
            .from("message_log")
            .select("id")
            .eq("related_id", lesson.id)
            .eq("recipient_id", guardian.id)
            .eq("message_type", "lesson_reminder")
            .gte("created_at", today.toISOString())
            .limit(1);
          if (existing && existing.length > 0) continue;

          // ── Email ──
          if (guardian.email) {
            let sendEmail = true;
            if (guardian.user_id) {
              sendEmail = await isNotificationEnabled(
                supabase,
                lesson.org_id,
                guardian.user_id,
                "email_lesson_reminders",
              );
            }

            if (sendEmail) {
              const subject = `Lesson Reminder: ${lesson.title} — ${lessonDate}`;
              const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #333; margin-bottom: 20px;">Lesson Reminder</h1>
                  <p>Dear ${escapeHtml(guardian.full_name)},</p>
                  <p>This is a reminder that <strong>${escapeHtml(studentNameList)}</strong> has a lesson tomorrow:</p>
                  <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
                    <p style="margin: 5px 0;"><strong>Lesson:</strong> ${escapeHtml(lesson.title)}</p>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${lessonDate}</p>
                    <p style="margin: 5px 0;"><strong>Time:</strong> ${lessonTime}</p>
                  </div>
                  <p style="text-align: center;">
                    <a href="${portalLink}"
                       style="display:inline-block;background-color:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">
                      View Schedule
                    </a>
                  </p>
                  <p>Thank you,<br>${escapeHtml(orgName)}</p>
                </div>`;

              // Log
              const { data: logEntry } = await supabase
                .from("message_log")
                .insert({
                  org_id: lesson.org_id,
                  channel: "email",
                  subject,
                  body: html,
                  sender_user_id: null,
                  recipient_email: guardian.email,
                  recipient_name: guardian.full_name,
                  recipient_type: "guardian",
                  recipient_id: guardian.id,
                  related_id: lesson.id,
                  message_type: "lesson_reminder",
                  status: resendApiKey ? "pending" : "logged",
                })
                .select("id")
                .single();

              if (resendApiKey) {
                const response = await fetch(
                  "https://api.resend.com/emails",
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${resendApiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      from: `${orgName} <notifications@lessonloop.net>`,
                      to: [guardian.email],
                      subject,
                      html,
                    }),
                  },
                );

                if (logEntry) {
                  const result = await response.json();
                  await supabase
                    .from("message_log")
                    .update({
                      status: response.ok ? "sent" : "failed",
                      sent_at: response.ok ? new Date().toISOString() : null,
                      error_message: response.ok
                        ? null
                        : JSON.stringify(result),
                    })
                    .eq("id", logEntry.id);
                }

                if (response.ok) emailsSent++;
              } else {
                emailsSent++;
              }
            }
          }

          // ── SMS ──
          const smsBody =
            `${orgName}: Reminder — ${studentNameList}'s ${lesson.title} lesson is tomorrow at ${lessonTime}.`;
          const smsResult = await maybeSendSms(supabase, {
            orgId: lesson.org_id,
            guardianId: guardian.id,
            guardianPhone: guardian.phone,
            guardianEmail: guardian.email,
            guardianUserId: guardian.user_id,
            guardianName: guardian.full_name,
            guardianSmsOptedIn: guardian.sms_opted_in,
            smsPrefKey: "sms_lesson_reminders",
            relatedId: lesson.id,
            messageType: "lesson_reminder_sms",
            body: smsBody,
          });
          if (smsResult.sent) smsSent++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Lesson ${lesson.id}: ${msg}`);
      }
    }

    console.log(
      `Lesson reminder job complete. Emails: ${emailsSent}, SMS: ${smsSent}, Errors: ${errors.length}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        smsSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Lesson reminder error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
