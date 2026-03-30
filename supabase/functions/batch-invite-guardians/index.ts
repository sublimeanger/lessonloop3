import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/escape-html.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const BATCH_SIZE = 50;

interface BatchInviteRequest {
  org_id: string;
  import_batch_id?: string;
  guardian_ids?: string[];
}

interface InviteResult {
  guardian_id: string;
  guardian_name: string;
  email: string;
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- JWT Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // --- Rate limiting ---
    const rlResult = await checkRateLimit(user.id, "batch-invite-guardians");
    if (!rlResult.allowed) {
      return rateLimitResponse(corsHeaders, rlResult);
    }

    // --- Parse body ---
    const body: BatchInviteRequest = await req.json();
    const { org_id, import_batch_id, guardian_ids } = body;

    if (!org_id) {
      return new Response(
        JSON.stringify({ error: "org_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // --- Authorisation: only admin/owner of the org ---
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("org_id", org_id)
      .in("role", ["owner", "admin"])
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden — admin or owner role required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // --- Fetch org name ---
    const { data: org, error: orgError } = await supabase
      .from("organisations")
      .select("name")
      .eq("id", org_id)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organisation not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // --- Build guardian query ---
    // Find guardians who:
    // 1. Belong to this org
    // 2. Have an email address
    // 3. Don't have a user_id (haven't created an account yet)
    let guardianQuery = supabase
      .from("guardians")
      .select("id, full_name, email")
      .eq("org_id", org_id)
      .not("email", "is", null)
      .is("user_id", null);

    if (guardian_ids && guardian_ids.length > 0) {
      // Specific guardians requested
      guardianQuery = guardianQuery.in("id", guardian_ids);
    } else if (import_batch_id) {
      // Only guardians linked to students from this import batch
      // Get student IDs from the batch first
      const { data: batchStudents, error: batchError } = await supabase
        .from("students")
        .select("id")
        .eq("org_id", org_id)
        .eq("import_batch_id", import_batch_id);

      if (batchError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch import batch students" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!batchStudents || batchStudents.length === 0) {
        return new Response(
          JSON.stringify({ sent: 0, skipped: 0, failed: 0, results: [] }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const studentIds = batchStudents.map((s) => s.id);

      // Get guardian IDs linked to these students
      const { data: links, error: linksError } = await supabase
        .from("student_guardians")
        .select("guardian_id")
        .in("student_id", studentIds);

      if (linksError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch student guardians" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!links || links.length === 0) {
        return new Response(
          JSON.stringify({ sent: 0, skipped: 0, failed: 0, results: [] }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const batchGuardianIds = [...new Set(links.map((l) => l.guardian_id))];
      guardianQuery = guardianQuery.in("id", batchGuardianIds);
    }

    const { data: guardians, error: guardiansError } = await guardianQuery;

    if (guardiansError) {
      console.error("Error fetching guardians:", guardiansError.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch guardians" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!guardians || guardians.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, skipped: 0, failed: 0, results: [] }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // --- Fetch existing pending invites for these emails to skip duplicates ---
    const guardianEmails = guardians.map((g) => g.email!.toLowerCase());
    const { data: existingInvites } = await supabase
      .from("invites")
      .select("email, accepted_at, expires_at")
      .eq("org_id", org_id)
      .in("email", guardianEmails);

    // Build set of emails that already have a pending (not expired, not accepted) invite
    const alreadyInvitedEmails = new Set<string>();
    if (existingInvites) {
      for (const inv of existingInvites) {
        const isAccepted = !!inv.accepted_at;
        const isExpired = new Date(inv.expires_at) < new Date();
        if (!isAccepted && !isExpired) {
          alreadyInvitedEmails.add(inv.email.toLowerCase());
        }
      }
    }

    // --- Get related_student_id for each guardian (first linked student) ---
    const guardianIds = guardians.map((g) => g.id);
    const { data: guardianStudentLinks } = await supabase
      .from("student_guardians")
      .select("guardian_id, student_id")
      .in("guardian_id", guardianIds);

    const guardianToStudent = new Map<string, string>();
    if (guardianStudentLinks) {
      for (const link of guardianStudentLinks) {
        // Use first linked student if guardian has multiple
        if (!guardianToStudent.has(link.guardian_id)) {
          guardianToStudent.set(link.guardian_id, link.student_id);
        }
      }
    }

    // --- Process invites in batches ---
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const results: InviteResult[] = [];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Process in chunks of BATCH_SIZE
    for (let i = 0; i < guardians.length; i += BATCH_SIZE) {
      const chunk = guardians.slice(i, i + BATCH_SIZE);

      const chunkPromises = chunk.map(async (guardian): Promise<InviteResult> => {
        const email = guardian.email!.toLowerCase();

        // Skip if already has a pending invite
        if (alreadyInvitedEmails.has(email)) {
          return {
            guardian_id: guardian.id,
            guardian_name: guardian.full_name,
            email,
            status: "skipped",
            reason: "Pending invite already exists",
          };
        }

        try {
          // Delete any existing expired/accepted invite for this email+org
          // (invites has UNIQUE on org_id, email)
          await supabase
            .from("invites")
            .delete()
            .eq("org_id", org_id)
            .eq("email", email);

          // Insert new invite
          const { data: invite, error: inviteError } = await supabase
            .from("invites")
            .insert({
              org_id,
              email,
              role: "parent",
              related_student_id: guardianToStudent.get(guardian.id) || null,
            })
            .select("id, token")
            .single();

          if (inviteError) {
            console.error(`Error creating invite for ${email}:`, inviteError.message);
            return {
              guardian_id: guardian.id,
              guardian_name: guardian.full_name,
              email,
              status: "failed",
              reason: inviteError.message,
            };
          }

          // Build email
          const inviteUrl = `${frontendUrl}/accept-invite?token=${invite.token}`;
          const subject = `You've been invited to join ${escapeHtml(org.name)}`;
          const htmlBody = `
            <h2>You're invited!</h2>
            <p>${escapeHtml(org.name)} has invited you to join <strong>${escapeHtml(org.name)}</strong> as a <strong>parent</strong>.</p>
            <p>Click the link below to accept the invitation and set up your account:</p>
            <p><a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
            <p>Or copy this link: ${escapeHtml(inviteUrl)}</p>
            <p>This invitation will expire in 7 days.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          `;

          // Log to message_log
          await supabase.from("message_log").insert({
            org_id,
            recipient_email: email,
            recipient_name: guardian.full_name,
            message_type: "invite",
            subject,
            body: htmlBody,
            status: "pending",
            related_id: invite.id,
          });

          // Send email if Resend is configured
          if (resend) {
            try {
              await resend.emails.send({
                from: "LessonLoop <noreply@lessonloop.net>",
                to: [email],
                subject,
                html: htmlBody,
              });

              await supabase
                .from("message_log")
                .update({ status: "sent", sent_at: new Date().toISOString() })
                .eq("related_id", invite.id)
                .eq("message_type", "invite");
            } catch (emailErr: unknown) {
              const emailErrMsg = emailErr instanceof Error ? emailErr.message : "Email send failed";
              console.error(`Email send error for ${email}:`, emailErrMsg);

              await supabase
                .from("message_log")
                .update({ status: "failed", error_message: emailErrMsg })
                .eq("related_id", invite.id)
                .eq("message_type", "invite");

              // Invite was created even if email failed — still counts as sent
            }
          } else {
            await supabase
              .from("message_log")
              .update({
                status: "pending",
                error_message: "No email provider configured. Invite URL: " + inviteUrl,
              })
              .eq("related_id", invite.id)
              .eq("message_type", "invite");
          }

          return {
            guardian_id: guardian.id,
            guardian_name: guardian.full_name,
            email,
            status: "sent",
          };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`Error processing invite for ${guardian.full_name}:`, errMsg);
          return {
            guardian_id: guardian.id,
            guardian_name: guardian.full_name,
            email,
            status: "failed",
            reason: errMsg,
          };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);

      for (const result of chunkResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
          if (result.value.status === "sent") sentCount++;
          else if (result.value.status === "skipped") skippedCount++;
          else failedCount++;
        } else {
          failedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        sent: sentCount,
        skipped: skippedCount,
        failed: failedCount,
        total: guardians.length,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in batch-invite-guardians:", (error as Error)?.message || "unknown error");
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
