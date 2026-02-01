import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

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
}

interface Guardian {
  id: string;
  full_name: string;
  email: string;
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

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting - stricter for bulk messaging
    const rateLimitResult = await checkRateLimit(user.id, "send-bulk-message");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult.retryAfterSeconds);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is org admin
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", (await req.json() as BulkMessageRequest).org_id)
      .eq("status", "active")
      .single();

    // Re-parse body since we consumed it
    const data: BulkMessageRequest = await req.clone().json();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Only admins can send bulk messages" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    if (!data.org_id || !data.subject || !data.body || !data.name) {
      throw new Error("Missing required fields: org_id, name, subject, body");
    }

    // Get org details for branding
    const { data: org } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", data.org_id)
      .single();

    const orgName = org?.name || "LessonLoop";

    // Build query for guardians based on filter criteria
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

    // Send emails to all recipients
    let sentCount = 0;
    let failedCount = 0;

    for (const guardian of guardians) {
      let emailSent = false;
      let errorMessage: string | null = null;

      if (resendApiKey && guardian.email) {
        try {
          const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${orgName} <notifications@lessonloop.net>`,
              to: [guardian.email],
              subject: data.subject,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">${data.subject}</h2>
                  <div style="white-space: pre-wrap; color: #555; line-height: 1.6;">
                    ${data.body.replace(/\n/g, "<br>")}
                  </div>
                  <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
                  <p style="color: #999; font-size: 12px;">
                    This message was sent via ${orgName} on LessonLoop.
                  </p>
                </div>
              `,
            }),
          });

          if (resendResponse.ok) {
            emailSent = true;
            sentCount++;
          } else {
            const errorResult = await resendResponse.text();
            console.error(`Resend API error for ${guardian.email}:`, errorResult);
            errorMessage = `Email send failed: ${errorResult}`;
            failedCount++;
          }
        } catch (emailError: any) {
          console.error(`Error sending to ${guardian.email}:`, emailError);
          errorMessage = emailError.message;
          failedCount++;
        }
      } else {
        errorMessage = "Email service not configured or no email address";
        failedCount++;
      }

      // Log each message
      await supabase.from("message_log").insert({
        org_id: data.org_id,
        batch_id: batch.id,
        channel: "email",
        subject: data.subject,
        body: data.body,
        sender_user_id: user.id,
        recipient_type: "guardian",
        recipient_id: guardian.id,
        recipient_email: guardian.email,
        recipient_name: guardian.full_name,
        message_type: "bulk",
        status: emailSent ? "sent" : "failed",
        sent_at: emailSent ? new Date().toISOString() : null,
        error_message: errorMessage,
      });

      // Add small delay to avoid rate limiting from Resend (100 emails/second allowed)
      if (guardians.length > 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Update batch record with final counts
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
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-message function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function fetchFilteredGuardians(
  supabase: any,
  orgId: string,
  filters: BulkMessageRequest["filter_criteria"]
): Promise<Guardian[]> {
  // Start with all students in org
  let studentQuery = supabase
    .from("students")
    .select("id")
    .eq("org_id", orgId)
    .is("deleted_at", null);

  // Filter by status
  if (filters.status && filters.status !== "all") {
    studentQuery = studentQuery.eq("status", filters.status);
  } else if (!filters.status) {
    // Default to active students
    studentQuery = studentQuery.eq("status", "active");
  }

  // Filter by location
  if (filters.location_ids && filters.location_ids.length > 0) {
    studentQuery = studentQuery.in("default_location_id", filters.location_ids);
  }

  // Filter by teacher
  if (filters.teacher_ids && filters.teacher_ids.length > 0) {
    // Get students assigned to these teachers
    const { data: assignments } = await supabase
      .from("student_teacher_assignments")
      .select("student_id")
      .eq("org_id", orgId)
      .in("teacher_user_id", filters.teacher_ids);

    if (assignments && assignments.length > 0) {
      const studentIds = assignments.map((a: any) => a.student_id);
      studentQuery = studentQuery.in("id", studentIds);
    } else {
      // No students match teacher filter
      return [];
    }
  }

  const { data: students, error: studentError } = await studentQuery;
  if (studentError || !students || students.length === 0) {
    return [];
  }

  const studentIds = students.map((s: any) => s.id);

  // Get guardians linked to these students
  const { data: studentGuardians, error: sgError } = await supabase
    .from("student_guardians")
    .select("guardian_id")
    .in("student_id", studentIds);

  if (sgError || !studentGuardians || studentGuardians.length === 0) {
    return [];
  }

  const guardianIds = [...new Set(studentGuardians.map((sg: any) => sg.guardian_id))];

  // Fetch guardian details
  let guardianQuery = supabase
    .from("guardians")
    .select("id, full_name, email")
    .in("id", guardianIds)
    .is("deleted_at", null)
    .not("email", "is", null);

  const { data: guardians, error: guardianError } = await guardianQuery;
  if (guardianError) {
    console.error("Error fetching guardians:", guardianError);
    return [];
  }

  // Filter for overdue invoices if requested
  if (filters.has_overdue_invoice) {
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("payer_guardian_id")
      .eq("org_id", orgId)
      .eq("status", "overdue")
      .not("payer_guardian_id", "is", null);

    if (overdueInvoices && overdueInvoices.length > 0) {
      const overdueGuardianIds = new Set(overdueInvoices.map((i: any) => i.payer_guardian_id));
      return guardians.filter((g: Guardian) => overdueGuardianIds.has(g.id));
    }
    return [];
  }

  return guardians || [];
}

serve(handler);
