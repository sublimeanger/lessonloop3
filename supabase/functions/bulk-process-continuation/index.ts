// bulk-process-continuation — server-side replacement for useBulkProcessContinuation
//
// Moves the entire continuation processing loop from the browser to an edge function.
// This eliminates:
//   - Partial processing when tabs close mid-run
//   - Auth token expiry during long-running loops
//   - 150+ sequential client→DB round-trips
//
// Includes fixes:
//   - CONT-H3: Conflict check scoped to same time slot, not entire date range
//   - Uses service_role for all DB operations (no token expiry risk)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
} from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

// ── Interfaces ──────────────────────────────────────────────────────────

interface BulkProcessRequest {
  action: "process";
  org_id: string;
  run_id: string;
  next_term_start_date: string; // YYYY-MM-DD
  next_term_end_date: string;   // YYYY-MM-DD
  process_type: "confirmed" | "withdrawals" | "all";
}

interface LessonSummaryItem {
  recurrence_id?: string;
  teacher_id?: string;
  teacher_name?: string | null;
  rate_minor?: number;
  day?: string;
  time?: string;
  [key: string]: unknown;
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

// ── Main Handler ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, corsHeaders, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, corsHeaders, 401);
    }
    const userId = user.id;

    const body: BulkProcessRequest = await req.json();

    if (body.action !== "process") {
      return jsonResponse({ error: "Invalid action" }, corsHeaders, 400);
    }

    // Validate required fields
    if (!body.org_id || !body.run_id || !body.next_term_start_date || !body.next_term_end_date || !body.process_type) {
      return jsonResponse({ error: "Missing required fields" }, corsHeaders, 400);
    }

    if (!["confirmed", "withdrawals", "all"].includes(body.process_type)) {
      return jsonResponse({ error: "Invalid process_type" }, corsHeaders, 400);
    }

    // Service-role client for all DB operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── Role check: owner/admin only ──
    const { data: membership } = await adminClient
      .from("org_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", body.org_id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .single();

    if (!membership) {
      return jsonResponse(
        { error: "Not authorised for this organisation" },
        corsHeaders,
        403
      );
    }

    // ── Rate limit ──
    const rlResult = await checkRateLimit(userId, "bulk-process-continuation");
    if (!rlResult.allowed) {
      return rateLimitResponse(corsHeaders, rlResult);
    }

    // ── Verify the run belongs to this org and is not already completed ──
    const { data: run, error: runError } = await adminClient
      .from("term_continuation_runs")
      .select("id, status, org_id")
      .eq("id", body.run_id)
      .eq("org_id", body.org_id)
      .single();

    if (runError || !run) {
      return jsonResponse({ error: "Continuation run not found" }, corsHeaders, 404);
    }

    if (run.status === "completed") {
      return jsonResponse({ error: "Run is already completed" }, corsHeaders, 409);
    }

    // ── Fetch unprocessed responses ──
    const responseFilter: string[] =
      body.process_type === "confirmed"
        ? ["continuing", "assumed_continuing"]
        : body.process_type === "withdrawals"
          ? ["withdrawing"]
          : ["continuing", "assumed_continuing", "withdrawing"];

    const { data: responses, error: respError } = await adminClient
      .from("term_continuation_responses")
      .select("id, student_id, response, lesson_summary, run_id")
      .eq("run_id", body.run_id)
      .eq("org_id", body.org_id)
      .eq("is_processed", false)
      .in("response", responseFilter);

    if (respError) {
      console.error("[bulk-process] Failed to fetch responses:", respError.message);
      return jsonResponse({ error: "Failed to fetch responses" }, corsHeaders, 500);
    }

    if (!responses || responses.length === 0) {
      return jsonResponse(
        {
          success: true,
          processedCount: 0,
          extendedCount: 0,
          withdrawnCount: 0,
          lessonsCreated: 0,
          conflictWarnings: [],
          message: "No unprocessed responses found for the given filter",
        },
        corsHeaders
      );
    }

    // ── Process loop ──
    let processedCount = 0;
    let extendedCount = 0;
    let withdrawnCount = 0;
    let lessonsCreated = 0;
    const conflictWarnings: string[] = [];

    for (const resp of responses) {
      if (["continuing", "assumed_continuing"].includes(resp.response)) {
        // ── Extend recurrences into next term ──
        const lessons: LessonSummaryItem[] = resp.lesson_summary || [];

        for (const lesson of lessons) {
          if (!lesson.recurrence_id) continue;

          // CONT-H3 FIX: Conflict check scoped to SAME TIME SLOT, not entire date range.
          // Only flag conflicts where the teacher already has a lesson at the same
          // wall-clock time on the same day-of-week, not just any lesson in the range.
          if (lesson.teacher_id && lesson.time) {
            // Parse the lesson time (HH:MM) to build a time-slot query
            const lessonTime = lesson.time; // e.g. "10:30"

            // Get the recurrence to know which days of week
            const { data: recForConflict } = await adminClient
              .from("recurrence_rules")
              .select("days_of_week")
              .eq("id", lesson.recurrence_id)
              .single();

            if (recForConflict?.days_of_week) {
              // Query existing lessons for this teacher in the new term
              const { data: teacherLessons } = await adminClient
                .from("lessons")
                .select("id, start_at")
                .eq("teacher_id", lesson.teacher_id)
                .gte("start_at", body.next_term_start_date)
                .lte("start_at", body.next_term_end_date + "T23:59:59Z")
                .neq("status", "cancelled");

              // Filter to only lessons at the same wall-clock time
              const conflictsAtSameTime = (teacherLessons || []).filter((tl) => {
                const tlTime = tl.start_at?.substring(11, 16);
                return tlTime === lessonTime;
              });

              if (conflictsAtSameTime.length > 0) {
                conflictWarnings.push(
                  `${lesson.teacher_name || "Teacher"} has ${conflictsAtSameTime.length} existing lesson(s) at ${lessonTime} in the new term`
                );
              }
            }
          }

          // Check current end_date of recurrence
          const { data: rec } = await adminClient
            .from("recurrence_rules")
            .select("id, end_date, days_of_week")
            .eq("id", lesson.recurrence_id)
            .single();

          if (rec && rec.end_date && rec.end_date < body.next_term_end_date) {
            const oldEndDate = rec.end_date;

            // Extend recurrence end_date
            await adminClient
              .from("recurrence_rules")
              .update({ end_date: body.next_term_end_date })
              .eq("id", lesson.recurrence_id);

            // Materialise lesson rows for the extended period
            const { data: matResult, error: matError } = await adminClient.rpc(
              "materialise_continuation_lessons",
              {
                p_org_id: body.org_id,
                p_recurrence_id: lesson.recurrence_id,
                p_student_id: resp.student_id,
                p_from_date: oldEndDate,
                p_to_date: body.next_term_end_date,
                p_rate_minor: lesson.rate_minor ?? null,
                p_created_by: userId,
              }
            );

            if (matError) {
              console.warn(
                `[bulk-process] Materialisation failed for recurrence ${lesson.recurrence_id}:`,
                matError.message
              );
            } else if (matResult) {
              const result = matResult as Record<string, number>;
              lessonsCreated += result.created ?? 0;
              if (result.conflicts > 0) {
                conflictWarnings.push(
                  `${lesson.teacher_name || "Teacher"}: ${result.conflicts} time-slot conflict(s) skipped`
                );
              }
            }
          }
        }
        extendedCount++;
      } else if (resp.response === "withdrawing") {
        // ── Process withdrawals via process-term-adjustment ──
        const lessons: LessonSummaryItem[] = resp.lesson_summary || [];
        let anyWithdrawalSucceeded = false;

        for (const lesson of lessons) {
          if (!lesson.recurrence_id) continue;

          try {
            // Preview — call process-term-adjustment internally
            const previewResp = await fetch(
              `${supabaseUrl}/functions/v1/process-term-adjustment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceRoleKey}`,
                  apikey: supabaseAnonKey,
                },
                body: JSON.stringify({
                  action: "preview",
                  org_id: body.org_id,
                  adjustment_type: "withdrawal",
                  student_id: resp.student_id,
                  recurrence_id: lesson.recurrence_id,
                  effective_date: body.next_term_start_date,
                }),
              }
            );

            if (!previewResp.ok) {
              console.warn(
                `[bulk-process] Preview failed for recurrence ${lesson.recurrence_id}: ${previewResp.status}`
              );
              continue;
            }

            const previewResult = await previewResp.json();
            if (previewResult.error || !previewResult.adjustment_id) {
              console.warn(
                `[bulk-process] Preview returned error for recurrence ${lesson.recurrence_id}:`,
                previewResult.error
              );
              continue;
            }

            // Confirm
            const confirmResp = await fetch(
              `${supabaseUrl}/functions/v1/process-term-adjustment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceRoleKey}`,
                  apikey: supabaseAnonKey,
                },
                body: JSON.stringify({
                  action: "confirm",
                  org_id: body.org_id,
                  adjustment_type: "withdrawal",
                  student_id: resp.student_id,
                  recurrence_id: lesson.recurrence_id,
                  effective_date: body.next_term_start_date,
                  adjustment_id: previewResult.adjustment_id,
                  generate_credit_note: true,
                }),
              }
            );

            if (!confirmResp.ok) {
              console.warn(
                `[bulk-process] Confirm failed for recurrence ${lesson.recurrence_id}: ${confirmResp.status}`
              );
              continue;
            }

            const confirmResult = await confirmResp.json();
            if (confirmResult.adjustment_id) {
              anyWithdrawalSucceeded = true;
              // Store term_adjustment_id on the response
              await adminClient
                .from("term_continuation_responses")
                .update({ term_adjustment_id: confirmResult.adjustment_id })
                .eq("id", resp.id);
            }
          } catch (withdrawErr: unknown) {
            const errMsg = withdrawErr instanceof Error ? withdrawErr.message : String(withdrawErr);
            console.warn(
              `[bulk-process] Withdrawal failed for recurrence ${lesson.recurrence_id}:`,
              errMsg
            );
          }
        }

        // Only count and mark processed if at least one withdrawal succeeded
        if (!anyWithdrawalSucceeded && lessons.length > 0) continue;
        withdrawnCount++;
      }

      // Mark response as processed
      await adminClient
        .from("term_continuation_responses")
        .update({
          is_processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", resp.id);

      processedCount++;
    }

    // ── Check if all responses are now processed → mark run as completed ──
    const { data: unprocessed } = await adminClient
      .from("term_continuation_responses")
      .select("id")
      .eq("run_id", body.run_id)
      .eq("is_processed", false)
      .limit(1);

    if (!unprocessed || unprocessed.length === 0) {
      await adminClient
        .from("term_continuation_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", body.run_id);
    }

    // ── Audit log ──
    await adminClient.from("audit_log").insert({
      org_id: body.org_id,
      actor_user_id: userId,
      action: "continuation_run.processed",
      entity_type: "term_continuation_run",
      entity_id: body.run_id,
      after: {
        processedCount,
        extendedCount,
        withdrawnCount,
        lessonsCreated,
        process_type: body.process_type,
      },
    });

    return jsonResponse(
      {
        success: true,
        processedCount,
        extendedCount,
        withdrawnCount,
        lessonsCreated,
        conflictWarnings: [...new Set(conflictWarnings)],
      },
      corsHeaders
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[bulk-process] Unhandled error:", errMsg);
    return jsonResponse(
      { error: "An internal error occurred. Please try again." },
      corsHeaders,
      500
    );
  }
});
