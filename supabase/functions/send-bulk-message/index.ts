import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/escape-html.ts";
import { isNotificationEnabled } from "../_shared/check-notification-pref.ts";

const BATCH_SIZE = 50;
const PORTAL_URL = "https://lessonloop3.lovable.app/portal/messages";

interface BulkMessageRequest {
  org_id: string;
  name: string;
  subject: string;
  body: string;
  filter_criteria: {
    location_ids?: string[];
    teacher_ids?: string[];
    status?: 'active' | 'inactive' | 'all';
    has_overdue_invoice?: boolean;
  };
  /** When false, only creates in-app messages without sending emails. Defaults to true. */
  send_email?: boolean;
}

interface Guardian {
  id: string;
  full_name: string;
  email: string;
  user_id: string | null;
}

interface SendResult {
  guardianId: string;
  email: string;
  success: boolean;
  error?: string;
}

async function sendSingleEmail(
  resendApiKey: string,
  fromAddress: string,
  guardian: Guardian,
  subject: string,
  htmlBody: string
): Promise<SendResult> {
  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [guardian.email],
        subject,
        html: htmlBody,
      }),
    });

    if (resendResponse.ok) {
      return { guardianId: guardian.id, email: guardian.email, success: true };
    }

    const errorText = await resendResponse.text();
    console.error("Resend API error for guardian:", guardian.id, errorText);
    return {
      guardianId: guardian.id,
      email: guardian.email,
      success: false,
      error: `HTTP ${resendResponse.status}: ${errorText}`,
    };
  } catch (err: any) {
    console.error("Error sending to guardian:", guardian.id);
    return {
      guardianId: guardian.id,
      email: guardian.email,
      success: false,
      error: err.message,
    };
  }
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

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

    // Rate limiting
    const rateLimitResult = await checkRateLimit(user.id, "send-bulk-message");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    const data: BulkMessageRequest = await req.json();
    const shouldSendEmail = data.send_email !== false;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is org admin
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", data.org_id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Only admins can send bulk messages" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data.org_id || !data.subject || !data.body || !data.name) {
      throw new Error("Missing required fields: org_id, name, subject, body");
    }

    // Get org details
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", data.org_id)
      .single();

    const orgName = org?.name || "LessonLoop";

    // Fetch filtered guardians
    const guardians = await fetchFilteredGuardians(supabase, data.org_id, data.filter_criteria);

    if (guardians.length === 0) {
      return new Response(
        JSON.stringify({ error: "No guardians match the selected filters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from("message_batches")
      .insert({
        org_id: data.org_id,
        name: data.name,
        subject: data.subject,
        body: data.body,
        filter_criteria: data.filter_criteria,
        recipient_count: guardians.length,
        sent_count: 0,
        failed_count: 0,
        status: "sending",
        created_by: user.id,
      })
      .select()
      .single();

    if (batchError) {
      console.error("Error creating batch:", batchError);
      throw new Error("Failed to create message batch");
    }

    // Build HTML template once
    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${escapeHtml(data.subject)}</h2>
        <div style="white-space: pre-wrap; color: #555; line-height: 1.6;">
          ${escapeHtml(data.body).replace(/\n/g, "<br>")}
        </div>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${PORTAL_URL}" style="display: inline-block; padding: 12px 28px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Reply in Your Portal
          </a>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center;">
          To reply to this message, please log in to your parent portal using the button above.
        </p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
        <p style="color: #999; font-size: 12px;">
          This message was sent via ${escapeHtml(orgName)} on LessonLoop.
        </p>
      </div>
    `;
    const fromAddress = `${orgName} <notifications@lessonloop.net>`;

    // ---- Handle in-app only mode ----
    if (!shouldSendEmail) {
      const logRows = guardians.map((g) => ({
        org_id: data.org_id,
        batch_id: batch.id,
        channel: "inapp",
        subject: data.subject,
        body: data.body,
        sender_user_id: user.id,
        recipient_type: "guardian",
        recipient_id: g.id,
        recipient_email: g.email,
        recipient_name: g.full_name,
        message_type: "bulk",
        status: "sent",
        sent_at: new Date().toISOString(),
        error_message: null,
      }));

      for (let i = 0; i < logRows.length; i += 500) {
        await supabase.from("message_log").insert(logRows.slice(i, i + 500));
      }

      await supabase
        .from("message_batches")
        .update({
          sent_count: guardians.length,
          failed_count: 0,
          status: "completed",
        })
        .eq("id", batch.id);

      return new Response(
        JSON.stringify({
          success: true,
          batch_id: batch.id,
          recipient_count: guardians.length,
          sent_count: guardians.length,
          failed_count: 0,
          skipped_by_preference: 0,
          errors: [],
          channel: "inapp",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // ---- Parallel batched email sending with preference checks ----
    const allResults: SendResult[] = [];
    const errorDetails: string[] = [];
    let skippedByPreference = 0;

    if (!resendApiKey) {
      for (const g of guardians) {
        allResults.push({
          guardianId: g.id,
          email: g.email,
          success: false,
          error: "Email service not configured",
        });
      }
    } else {
      const eligibleGuardians: Guardian[] = [];
      for (const g of guardians) {
        if (g.user_id) {
          const prefEnabled = await isNotificationEnabled(
            supabase, data.org_id, g.user_id, "email_marketing"
          );
          if (!prefEnabled) {
            skippedByPreference++;
            continue;
          }
        }
        eligibleGuardians.push(g);
      }

      for (let i = 0; i < eligibleGuardians.length; i += BATCH_SIZE) {
        const chunk = eligibleGuardians.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          chunk.map((g) =>
            sendSingleEmail(resendApiKey, fromAddress, g, data.subject, htmlBody)
          )
        );

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            allResults.push(result.value);
            if (!result.value.success && result.value.error) {
              errorDetails.push(`${result.value.email}: ${result.value.error}`);
            }
          } else {
            allResults.push({
              guardianId: "unknown",
              email: "unknown",
              success: false,
              error: result.reason?.message || "Unknown error",
            });
            errorDetails.push(result.reason?.message || "Unknown error");
          }
        }

        if (i + BATCH_SIZE < eligibleGuardians.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    const sentCount = allResults.filter((r) => r.success).length;
    const failedCount = allResults.filter((r) => !r.success).length;

    const logRows = allResults.map((r) => {
      const guardian = guardians.find((g) => g.id === r.guardianId);
      return {
        org_id: data.org_id,
        batch_id: batch.id,
        channel: "email",
        subject: data.subject,
        body: data.body,
        sender_user_id: user.id,
        recipient_type: "guardian",
        recipient_id: r.guardianId,
        recipient_email: r.email,
        recipient_name: guardian?.full_name || null,
        message_type: "bulk",
        status: r.success ? "sent" : "failed",
        sent_at: r.success ? new Date().toISOString() : null,
        error_message: r.error || null,
      };
    });

    for (let i = 0; i < logRows.length; i += 500) {
      await supabase.from("message_log").insert(logRows.slice(i, i + 500));
    }

    await supabase
      .from("message_batches")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: failedCount === guardians.length ? "failed" : "completed",
      })
      .eq("id", batch.id);

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batch.id,
        recipient_count: guardians.length,
        sent_count: sentCount,
        failed_count: failedCount,
        skipped_by_preference: skippedByPreference,
        errors: errorDetails.slice(0, 20),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-message function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

async function fetchFilteredGuardians(
  supabase: any,
  orgId: string,
  filters: BulkMessageRequest["filter_criteria"]
): Promise<Guardian[]> {
  let studentQuery = supabase
    .from("students")
    .select("id")
    .eq("org_id", orgId)
    .is("deleted_at", null);

  if (filters.status && filters.status !== "all") {
    studentQuery = studentQuery.eq("status", filters.status);
  } else if (!filters.status) {
    studentQuery = studentQuery.eq("status", "active");
  }

  if (filters.location_ids && filters.location_ids.length > 0) {
    studentQuery = studentQuery.in("default_location_id", filters.location_ids);
  }

  if (filters.teacher_ids && filters.teacher_ids.length > 0) {
    const { data: assignments } = await supabase
      .from("student_teacher_assignments")
      .select("student_id")
      .eq("org_id", orgId)
      .in("teacher_id", filters.teacher_ids);

    if (assignments && assignments.length > 0) {
      const studentIds = assignments.map((a: any) => a.student_id);
      studentQuery = studentQuery.in("id", studentIds);
    } else {
      return [];
    }
  }

  const { data: students, error: studentError } = await studentQuery;
  if (studentError || !students || students.length === 0) return [];

  const studentIds = students.map((s: any) => s.id);

  const { data: studentGuardians, error: sgError } = await supabase
    .from("student_guardians")
    .select("guardian_id")
    .in("student_id", studentIds);

  if (sgError || !studentGuardians || studentGuardians.length === 0) return [];

  const guardianIds = [...new Set(studentGuardians.map((sg: any) => sg.guardian_id))];

  const { data: guardians, error: guardianError } = await supabase
    .from("guardians")
    .select("id, full_name, email, user_id")
    .in("id", guardianIds)
    .is("deleted_at", null)
    .not("email", "is", null);

  if (guardianError) {
    console.error("Error fetching guardians:", guardianError);
    return [];
  }

  if (filters.has_overdue_invoice) {
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("payer_guardian_id")
      .eq("org_id", orgId)
      .eq("status", "overdue")
      .not("payer_guardian_id", "is", null);

    if (overdueInvoices && overdueInvoices.length > 0) {
      const overdueGuardianIds = new Set(
        overdueInvoices.map((i: any) => i.payer_guardian_id)
      );
      return guardians.filter((g: Guardian) => overdueGuardianIds.has(g.id));
    }
    return [];
  }

  return guardians || [];
}

serve(handler);
