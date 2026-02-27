import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
} from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

// ── Interfaces ──────────────────────────────────────────────────────────

interface RespondRequest {
  // Token-based flow (email link)
  token?: string;
  // Portal-based flow (authenticated)
  run_id?: string;
  student_id?: string;
  // Shared
  response: "continuing" | "withdrawing";
  withdrawal_reason?: string;
  withdrawal_notes?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function jsonResponse(
  data: unknown,
  cors: Record<string, string>,
  status = 200
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Recalculate and persist run summary. */
async function recalcSummary(client: any, runId: string) {
  const { data: responses } = await client
    .from("term_continuation_responses")
    .select("response")
    .eq("run_id", runId);

  const summary = {
    total_students: responses?.length || 0,
    confirmed: 0,
    withdrawing: 0,
    pending: 0,
    no_response: 0,
    assumed_continuing: 0,
  };

  for (const r of responses || []) {
    switch (r.response) {
      case "continuing":
        summary.confirmed++;
        break;
      case "withdrawing":
        summary.withdrawing++;
        break;
      case "pending":
        summary.pending++;
        break;
      case "no_response":
        summary.no_response++;
        break;
      case "assumed_continuing":
        summary.assumed_continuing++;
        break;
    }
  }

  await client
    .from("term_continuation_runs")
    .update({ summary })
    .eq("id", runId);

  return summary;
}

// ── Main Handler ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body: RespondRequest = await req.json();

    if (!["continuing", "withdrawing"].includes(body.response)) {
      return jsonResponse(
        { error: "response must be 'continuing' or 'withdrawing'" },
        corsHeaders,
        400
      );
    }

    // Determine flow: token-based or portal-based
    if (body.token) {
      return await handleTokenResponse(adminClient, body, corsHeaders);
    }

    // Portal-based: requires auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, corsHeaders, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, corsHeaders, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Rate limit
    const rateLimitResult = await checkRateLimit(
      userId,
      "continuation-respond"
    );
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    return await handlePortalResponse(
      adminClient,
      body,
      userId,
      corsHeaders
    );
  } catch (err: any) {
    console.error("[continuation-respond] Error:", err);
    return jsonResponse(
      { error: err.message || "Internal error" },
      corsHeaders,
      500
    );
  }
});

// ── Token-based response (email link) ───────────────────────────────────

async function handleTokenResponse(
  client: any,
  body: RespondRequest,
  cors: Record<string, string>
) {
  const { token, response, withdrawal_reason, withdrawal_notes } = body;

  // Rate limit by token hash (prevent brute force)
  const rateLimitResult = await checkRateLimit(token!, "continuation-respond");
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(cors, rateLimitResult);
  }

  // Look up response by token
  const { data: respRow, error: respError } = await client
    .from("term_continuation_responses")
    .select("id, run_id, student_id, guardian_id, response, org_id")
    .eq("response_token", token)
    .single();

  if (respError || !respRow) {
    return jsonResponse(
      { error: "Invalid or expired response link" },
      cors,
      404
    );
  }

  if (respRow.response !== "pending") {
    // Already responded — return current status
    return jsonResponse(
      {
        already_responded: true,
        current_response: respRow.response,
        message: "You have already responded to this continuation request.",
      },
      cors
    );
  }

  // Verify run is still accepting responses
  const { data: run } = await client
    .from("term_continuation_runs")
    .select("status, next_term_id, current_term_id")
    .eq("id", respRow.run_id)
    .single();

  if (!run || !["sent", "reminding"].includes(run.status)) {
    return jsonResponse(
      { error: "This continuation run is no longer accepting responses" },
      cors,
      400
    );
  }

  // Update response
  const now = new Date().toISOString();
  await client
    .from("term_continuation_responses")
    .update({
      response: response,
      response_at: now,
      response_method: "email_link",
      withdrawal_reason: response === "withdrawing" ? withdrawal_reason : null,
      withdrawal_notes: response === "withdrawing" ? withdrawal_notes : null,
    })
    .eq("id", respRow.id);

  // Get student name for confirmation
  const { data: student } = await client
    .from("students")
    .select("first_name, last_name")
    .eq("id", respRow.student_id)
    .single();

  // Get term names
  const { data: nextTerm } = await client
    .from("terms")
    .select("name")
    .eq("id", run.next_term_id)
    .single();

  // Recalculate summary
  await recalcSummary(client, respRow.run_id);

  return jsonResponse(
    {
      success: true,
      response: response,
      student_name: student
        ? `${student.first_name} ${student.last_name}`
        : "Student",
      next_term_name: nextTerm?.name || "Next Term",
    },
    cors
  );
}

// ── Portal-based response (authenticated parent) ────────────────────────

async function handlePortalResponse(
  client: any,
  body: RespondRequest,
  userId: string,
  cors: Record<string, string>
) {
  const { run_id, student_id, response, withdrawal_reason, withdrawal_notes } =
    body;

  if (!run_id || !student_id) {
    return jsonResponse(
      { error: "run_id and student_id are required" },
      cors,
      400
    );
  }

  // Look up guardian for this user
  const { data: guardian } = await client
    .from("guardians")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!guardian) {
    return jsonResponse(
      { error: "Guardian record not found" },
      cors,
      404
    );
  }

  // Find the response row
  const { data: respRow } = await client
    .from("term_continuation_responses")
    .select("id, run_id, response, org_id")
    .eq("run_id", run_id)
    .eq("student_id", student_id)
    .eq("guardian_id", guardian.id)
    .single();

  if (!respRow) {
    return jsonResponse(
      { error: "Continuation response not found for this student" },
      cors,
      404
    );
  }

  if (respRow.response !== "pending") {
    return jsonResponse(
      {
        already_responded: true,
        current_response: respRow.response,
        message: "You have already responded to this continuation request.",
      },
      cors
    );
  }

  // Verify run status
  const { data: run } = await client
    .from("term_continuation_runs")
    .select("status")
    .eq("id", run_id)
    .single();

  if (!run || !["sent", "reminding"].includes(run.status)) {
    return jsonResponse(
      { error: "This continuation run is no longer accepting responses" },
      cors,
      400
    );
  }

  // Update
  const now = new Date().toISOString();
  await client
    .from("term_continuation_responses")
    .update({
      response: response,
      response_at: now,
      response_method: "portal",
      withdrawal_reason: response === "withdrawing" ? withdrawal_reason : null,
      withdrawal_notes: response === "withdrawing" ? withdrawal_notes : null,
    })
    .eq("id", respRow.id);

  // Get student name
  const { data: student } = await client
    .from("students")
    .select("first_name, last_name")
    .eq("id", student_id)
    .single();

  await recalcSummary(client, run_id);

  return jsonResponse(
    {
      success: true,
      response: response,
      student_name: student
        ? `${student.first_name} ${student.last_name}`
        : "Student",
    },
    cors
  );
}
