import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
} from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

// ── Interfaces ──────────────────────────────────────────────────────────

interface ContinuationRunRequest {
  action: "create" | "send" | "send_reminders" | "process_deadline";
  org_id: string;
  // create
  current_term_id?: string;
  next_term_id?: string;
  notice_deadline?: string;
  assumed_continuing?: boolean;
  reminder_schedule?: number[];
  // send / send_reminders / process_deadline
  run_id?: string;
}

interface RateCard {
  id: string;
  duration_mins: number;
  rate_amount: number;
  is_default: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function findRateForDuration(
  durationMins: number,
  rateCards: RateCard[],
  fallbackMinor = 3000
): number {
  if (!rateCards.length) return fallbackMinor;
  const exact = rateCards.find((r) => r.duration_mins === durationMins);
  if (exact) return exact.rate_amount;
  const def = rateCards.find((r) => r.is_default);
  if (def) return def.rate_amount;
  return rateCards[0]?.rate_amount || fallbackMinor;
}

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

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const FRONTEND_URL =
  Deno.env.get("FRONTEND_URL") || "https://app.lessonloop.net";

/** Generate all dates for a given day-of-week within [start, end]. */
function generateDatesForDay(
  startDateStr: string,
  endDateStr: string,
  dayOfWeek: number
): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr + "T00:00:00Z");
  const end = new Date(endDateStr + "T23:59:59Z");

  const current = new Date(start);
  while (current.getUTCDay() !== dayOfWeek) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return dates;
}

/** Recalculate and persist run summary from response rows. */
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
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, corsHeaders, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body: ContinuationRunRequest = await req.json();

    // Rate limit
    const rateLimitResult = await checkRateLimit(
      userId,
      "create-continuation-run"
    );
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    // Verify user role
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

    switch (body.action) {
      case "create":
        return await handleCreate(adminClient, body, userId, corsHeaders);
      case "send":
        return await handleSend(adminClient, body, userId, corsHeaders);
      case "send_reminders":
        return await handleSendReminders(
          adminClient,
          body,
          userId,
          corsHeaders
        );
      case "process_deadline":
        return await handleProcessDeadline(
          adminClient,
          body,
          userId,
          corsHeaders
        );
      default:
        return jsonResponse({ error: "Invalid action" }, corsHeaders, 400);
    }
  } catch (err: any) {
    console.error("[create-continuation-run] Error:", err);
    return jsonResponse(
      { error: err.message || "Internal error" },
      corsHeaders,
      500
    );
  }
});

// ── Action: create ──────────────────────────────────────────────────────

async function handleCreate(
  client: any,
  body: ContinuationRunRequest,
  userId: string,
  cors: Record<string, string>
) {
  const orgId = body.org_id;
  const { current_term_id, next_term_id, notice_deadline } = body;

  if (!current_term_id || !next_term_id || !notice_deadline) {
    return jsonResponse(
      { error: "current_term_id, next_term_id, and notice_deadline are required" },
      cors,
      400
    );
  }

  // 1. Validate terms
  const { data: currentTerm } = await client
    .from("terms")
    .select("*")
    .eq("id", current_term_id)
    .eq("org_id", orgId)
    .single();

  const { data: nextTerm } = await client
    .from("terms")
    .select("*")
    .eq("id", next_term_id)
    .eq("org_id", orgId)
    .single();

  if (!currentTerm || !nextTerm) {
    return jsonResponse({ error: "Terms not found" }, cors, 404);
  }

  if (nextTerm.start_date <= currentTerm.end_date) {
    return jsonResponse(
      { error: "Next term must start after current term ends" },
      cors,
      400
    );
  }

  // 2. Check for existing non-completed run
  const { data: existingRuns } = await client
    .from("term_continuation_runs")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("current_term_id", current_term_id)
    .eq("next_term_id", next_term_id)
    .neq("status", "completed");

  if (existingRuns && existingRuns.length > 0) {
    return jsonResponse(
      { error: "A continuation run already exists for this term pair" },
      cors,
      409
    );
  }

  // 3. Find active students with recurring lessons in current term
  const { data: lessonData, error: lessonError } = await client
    .from("lesson_participants")
    .select(`
      student_id,
      lessons!inner (
        id,
        recurrence_id,
        start_at,
        end_at,
        status,
        teacher_id,
        recurrence_rules!inner (
          id,
          days_of_week
        )
      )
    `)
    .eq("org_id", orgId)
    .not("lessons.recurrence_id", "is", null)
    .neq("lessons.status", "cancelled")
    .gte("lessons.start_at", currentTerm.start_date + "T00:00:00Z")
    .lte("lessons.start_at", currentTerm.end_date + "T23:59:59Z");

  if (lessonError) {
    console.error("Lesson query error:", lessonError);
    // Fallback: query without nested join
    return await handleCreateFallback(
      client, body, userId, cors, currentTerm, nextTerm
    );
  }

  // Group by student → recurrence
  const studentRecurrences = new Map<
    string,
    Map<string, { lessons: any[]; recurrence: any }>
  >();

  for (const lp of lessonData || []) {
    const studentId = lp.student_id;
    const lesson = lp.lessons as any;
    if (!lesson?.recurrence_id) continue;

    if (!studentRecurrences.has(studentId)) {
      studentRecurrences.set(studentId, new Map());
    }
    const recMap = studentRecurrences.get(studentId)!;
    const recId = lesson.recurrence_id;
    if (!recMap.has(recId)) {
      recMap.set(recId, { lessons: [], recurrence: lesson.recurrence_rules });
    }
    recMap.get(recId)!.lessons.push(lesson);
  }

  // Filter to active students only
  const studentIds = Array.from(studentRecurrences.keys());
  if (studentIds.length === 0) {
    return jsonResponse(
      { error: "No active students with recurring lessons found in the current term" },
      cors,
      400
    );
  }

  const { data: students } = await client
    .from("students")
    .select("id, first_name, last_name, default_rate_card_id, status")
    .in("id", studentIds)
    .eq("org_id", orgId)
    .eq("status", "active")
    .is("deleted_at", null);

  const activeStudentIds = new Set((students || []).map((s: any) => s.id));
  const studentMap = new Map(
    (students || []).map((s: any) => [s.id, s])
  );

  // Get guardians (primary payers)
  const { data: guardianLinks } = await client
    .from("student_guardians")
    .select("student_id, guardian_id, is_primary_payer, guardians!inner(id, full_name, email)")
    .in("student_id", studentIds)
    .eq("org_id", orgId)
    .eq("is_primary_payer", true);

  const guardianMap = new Map<string, any>();
  for (const gl of guardianLinks || []) {
    guardianMap.set(gl.student_id, {
      guardian_id: gl.guardian_id,
      ...(gl.guardians as any),
    });
  }

  // Get rate cards
  const { data: rateCards } = await client
    .from("rate_cards")
    .select("id, duration_mins, rate_amount, is_default")
    .eq("org_id", orgId);

  // Get teachers for display names
  const { data: teachers } = await client
    .from("teachers")
    .select("id, display_name")
    .eq("org_id", orgId);

  const teacherMap = new Map(
    (teachers || []).map((t: any) => [t.id, t.display_name])
  );

  // Get student instruments
  const { data: studentInstruments } = await client
    .from("student_instruments")
    .select("student_id, instruments!inner(name)")
    .in("student_id", studentIds);

  const instrumentMap = new Map<string, string>();
  for (const si of studentInstruments || []) {
    const name = (si.instruments as any)?.name;
    if (name) {
      instrumentMap.set(si.student_id, name);
    }
  }

  // Get closure dates for next term
  const { data: closureDates } = await client
    .from("closure_dates")
    .select("date, location_id, applies_to_all_locations")
    .eq("org_id", orgId)
    .gte("date", nextTerm.start_date)
    .lte("date", nextTerm.end_date);

  const closureDateSet = new Set<string>();
  for (const cd of closureDates || []) {
    if (cd.applies_to_all_locations) {
      closureDateSet.add(cd.date);
    }
  }

  // 4. Insert run
  const { data: run, error: runError } = await client
    .from("term_continuation_runs")
    .insert({
      org_id: orgId,
      current_term_id,
      next_term_id,
      notice_deadline,
      assumed_continuing: body.assumed_continuing ?? true,
      reminder_schedule: body.reminder_schedule ?? [7, 14],
      status: "draft",
      summary: {},
      created_by: userId,
    })
    .select()
    .single();

  if (runError) throw runError;

  // 5. Build response rows
  const responseRows: any[] = [];
  const preview: any[] = [];

  for (const [studentId, recMap] of studentRecurrences) {
    if (!activeStudentIds.has(studentId)) continue;

    const student = studentMap.get(studentId);
    const guardian = guardianMap.get(studentId);

    if (!student || !guardian) continue;

    const lessonSummary: any[] = [];
    let totalFee = 0;

    for (const [recId, recData] of recMap) {
      const firstLesson = recData.lessons[0];
      const durationMs =
        new Date(firstLesson.end_at).getTime() -
        new Date(firstLesson.start_at).getTime();
      const durationMins = Math.round(durationMs / 60000);
      const timeStr = firstLesson.start_at.substring(11, 16);

      // Get rate
      let rate: number;
      if (student.default_rate_card_id && rateCards) {
        const studentCard = rateCards.find(
          (rc: any) => rc.id === student.default_rate_card_id
        );
        rate = studentCard
          ? studentCard.rate_amount
          : findRateForDuration(durationMins, rateCards || []);
      } else {
        rate = findRateForDuration(durationMins, rateCards || []);
      }

      // Count lessons in next term
      const daysOfWeek = recData.recurrence?.days_of_week || [];
      let lessonsNextTerm = 0;
      for (const dow of daysOfWeek) {
        const dates = generateDatesForDay(
          nextTerm.start_date,
          nextTerm.end_date,
          dow
        );
        lessonsNextTerm += dates.filter(
          (d) => !closureDateSet.has(d)
        ).length;
      }

      const fee = rate * lessonsNextTerm;
      totalFee += fee;

      lessonSummary.push({
        recurrence_id: recId,
        day: daysOfWeek.length > 0 ? DAY_NAMES[daysOfWeek[0]] : "Unknown",
        time: timeStr,
        teacher_name: firstLesson.teacher_id
          ? teacherMap.get(firstLesson.teacher_id) || null
          : null,
        instrument: instrumentMap.get(studentId) || null,
        duration_mins: durationMins,
        rate_minor: rate,
        lessons_next_term: lessonsNextTerm,
      });
    }

    responseRows.push({
      org_id: orgId,
      run_id: run.id,
      student_id: studentId,
      guardian_id: guardian.guardian_id,
      lesson_summary: lessonSummary,
      response: "pending",
      next_term_fee_minor: totalFee,
    });

    preview.push({
      student_name: `${student.first_name} ${student.last_name}`,
      guardian_name: guardian.full_name,
      guardian_email: guardian.email,
      lesson_count: lessonSummary.reduce(
        (sum: number, l: any) => sum + l.lessons_next_term,
        0
      ),
      fee_minor: totalFee,
      has_email: !!guardian.email,
    });
  }

  // 6. Bulk insert responses
  if (responseRows.length > 0) {
    const { error: insertError } = await client
      .from("term_continuation_responses")
      .insert(responseRows);
    if (insertError) throw insertError;
  }

  // 7. Update summary
  const summary = await recalcSummary(client, run.id);

  // 8. Audit log
  await client.from("audit_log").insert({
    org_id: orgId,
    actor_user_id: userId,
    action: "continuation_run.created",
    entity_type: "term_continuation_run",
    entity_id: run.id,
    after: {
      current_term: currentTerm.name,
      next_term: nextTerm.name,
      total_students: responseRows.length,
    },
  });

  return jsonResponse(
    {
      run_id: run.id,
      total_students: responseRows.length,
      summary,
      preview,
    },
    cors
  );
}

// Fallback create handler using simpler queries
async function handleCreateFallback(
  client: any,
  body: ContinuationRunRequest,
  userId: string,
  cors: Record<string, string>,
  currentTerm: any,
  nextTerm: any
) {
  const orgId = body.org_id;

  // Get lessons in current term with recurrence
  const { data: lessons } = await client
    .from("lessons")
    .select("id, recurrence_id, start_at, end_at, teacher_id, status")
    .eq("org_id", orgId)
    .not("recurrence_id", "is", null)
    .neq("status", "cancelled")
    .gte("start_at", currentTerm.start_date + "T00:00:00Z")
    .lte("start_at", currentTerm.end_date + "T23:59:59Z");

  if (!lessons || lessons.length === 0) {
    return jsonResponse(
      { error: "No recurring lessons found in the current term" },
      cors,
      400
    );
  }

  const lessonIds = lessons.map((l: any) => l.id);

  // Get participants
  const { data: participants } = await client
    .from("lesson_participants")
    .select("student_id, lesson_id")
    .in("lesson_id", lessonIds)
    .eq("org_id", orgId);

  // Build student → recurrence → lessons map
  const lessonMap = new Map(lessons.map((l: any) => [l.id, l]));
  const studentRecurrences = new Map<string, Map<string, any[]>>();

  for (const p of participants || []) {
    const lesson = lessonMap.get(p.lesson_id);
    if (!lesson?.recurrence_id) continue;

    if (!studentRecurrences.has(p.student_id)) {
      studentRecurrences.set(p.student_id, new Map());
    }
    const recMap = studentRecurrences.get(p.student_id)!;
    if (!recMap.has(lesson.recurrence_id)) {
      recMap.set(lesson.recurrence_id, []);
    }
    recMap.get(lesson.recurrence_id)!.push(lesson);
  }

  const studentIds = Array.from(studentRecurrences.keys());
  if (studentIds.length === 0) {
    return jsonResponse(
      { error: "No active students with recurring lessons found" },
      cors,
      400
    );
  }

  // Get active students
  const { data: students } = await client
    .from("students")
    .select("id, first_name, last_name, default_rate_card_id")
    .in("id", studentIds)
    .eq("org_id", orgId)
    .eq("status", "active")
    .is("deleted_at", null);

  const activeStudentIds = new Set((students || []).map((s: any) => s.id));
  const studentMap = new Map((students || []).map((s: any) => [s.id, s]));

  // Get primary payer guardians
  const { data: guardianLinks } = await client
    .from("student_guardians")
    .select("student_id, guardian_id")
    .in("student_id", studentIds)
    .eq("org_id", orgId)
    .eq("is_primary_payer", true);

  const guardianIdMap = new Map<string, string>();
  for (const gl of guardianLinks || []) {
    guardianIdMap.set(gl.student_id, gl.guardian_id);
  }

  const guardianIds = [...new Set(Array.from(guardianIdMap.values()))];
  const { data: guardians } = await client
    .from("guardians")
    .select("id, full_name, email")
    .in("id", guardianIds);

  const guardianDetailMap = new Map(
    (guardians || []).map((g: any) => [g.id, g])
  );

  // Get recurrence rules
  const recurrenceIds = [
    ...new Set(lessons.map((l: any) => l.recurrence_id).filter(Boolean)),
  ];
  const { data: recurrences } = await client
    .from("recurrence_rules")
    .select("id, days_of_week")
    .in("id", recurrenceIds);

  const recurrenceMap = new Map(
    (recurrences || []).map((r: any) => [r.id, r])
  );

  // Get rate cards
  const { data: rateCards } = await client
    .from("rate_cards")
    .select("id, duration_mins, rate_amount, is_default")
    .eq("org_id", orgId);

  // Get teachers
  const { data: teachers } = await client
    .from("teachers")
    .select("id, display_name")
    .eq("org_id", orgId);

  const teacherMap = new Map(
    (teachers || []).map((t: any) => [t.id, t.display_name])
  );

  // Get instruments
  const { data: studentInstruments } = await client
    .from("student_instruments")
    .select("student_id, instruments!inner(name)")
    .in("student_id", studentIds);

  const instrumentMap = new Map<string, string>();
  for (const si of studentInstruments || []) {
    const name = (si.instruments as any)?.name;
    if (name) instrumentMap.set(si.student_id, name);
  }

  // Get closure dates for next term
  const { data: closureDates } = await client
    .from("closure_dates")
    .select("date, applies_to_all_locations")
    .eq("org_id", orgId)
    .gte("date", nextTerm.start_date)
    .lte("date", nextTerm.end_date);

  const closureDateSet = new Set<string>();
  for (const cd of closureDates || []) {
    if (cd.applies_to_all_locations) closureDateSet.add(cd.date);
  }

  // Insert run
  const { data: run, error: runError } = await client
    .from("term_continuation_runs")
    .insert({
      org_id: orgId,
      current_term_id: body.current_term_id,
      next_term_id: body.next_term_id,
      notice_deadline: body.notice_deadline,
      assumed_continuing: body.assumed_continuing ?? true,
      reminder_schedule: body.reminder_schedule ?? [7, 14],
      status: "draft",
      summary: {},
      created_by: userId,
    })
    .select()
    .single();

  if (runError) throw runError;

  // Build response rows
  const responseRows: any[] = [];
  const preview: any[] = [];

  for (const [studentId, recMap] of studentRecurrences) {
    if (!activeStudentIds.has(studentId)) continue;

    const student = studentMap.get(studentId);
    const guardianId = guardianIdMap.get(studentId);
    if (!student || !guardianId) continue;

    const guardian = guardianDetailMap.get(guardianId);
    if (!guardian) continue;

    const lessonSummary: any[] = [];
    let totalFee = 0;

    for (const [recId, recLessons] of recMap) {
      const firstLesson = recLessons[0];
      const durationMs =
        new Date(firstLesson.end_at).getTime() -
        new Date(firstLesson.start_at).getTime();
      const durationMins = Math.round(durationMs / 60000);
      const timeStr = firstLesson.start_at.substring(11, 16);
      const recurrence = recurrenceMap.get(recId);
      const daysOfWeek = recurrence?.days_of_week || [];

      let rate: number;
      if (student.default_rate_card_id && rateCards) {
        const studentCard = rateCards.find(
          (rc: any) => rc.id === student.default_rate_card_id
        );
        rate = studentCard
          ? studentCard.rate_amount
          : findRateForDuration(durationMins, rateCards || []);
      } else {
        rate = findRateForDuration(durationMins, rateCards || []);
      }

      let lessonsNextTerm = 0;
      for (const dow of daysOfWeek) {
        const dates = generateDatesForDay(
          nextTerm.start_date,
          nextTerm.end_date,
          dow
        );
        lessonsNextTerm += dates.filter((d) => !closureDateSet.has(d)).length;
      }

      const fee = rate * lessonsNextTerm;
      totalFee += fee;

      lessonSummary.push({
        recurrence_id: recId,
        day: daysOfWeek.length > 0 ? DAY_NAMES[daysOfWeek[0]] : "Unknown",
        time: timeStr,
        teacher_name: firstLesson.teacher_id
          ? teacherMap.get(firstLesson.teacher_id) || null
          : null,
        instrument: instrumentMap.get(studentId) || null,
        duration_mins: durationMins,
        rate_minor: rate,
        lessons_next_term: lessonsNextTerm,
      });
    }

    responseRows.push({
      org_id: orgId,
      run_id: run.id,
      student_id: studentId,
      guardian_id: guardianId,
      lesson_summary: lessonSummary,
      response: "pending",
      next_term_fee_minor: totalFee,
    });

    preview.push({
      student_name: `${student.first_name} ${student.last_name}`,
      guardian_name: guardian.full_name,
      guardian_email: guardian.email,
      lesson_count: lessonSummary.reduce(
        (sum: number, l: any) => sum + l.lessons_next_term,
        0
      ),
      fee_minor: totalFee,
      has_email: !!guardian.email,
    });
  }

  if (responseRows.length > 0) {
    const { error: insertError } = await client
      .from("term_continuation_responses")
      .insert(responseRows);
    if (insertError) throw insertError;
  }

  const summary = await recalcSummary(client, run.id);

  await client.from("audit_log").insert({
    org_id: orgId,
    actor_user_id: userId,
    action: "continuation_run.created",
    entity_type: "term_continuation_run",
    entity_id: run.id,
    after: {
      current_term: currentTerm.name,
      next_term: nextTerm.name,
      total_students: responseRows.length,
    },
  });

  return jsonResponse(
    { run_id: run.id, total_students: responseRows.length, summary, preview },
    cors
  );
}

// ── Action: send ────────────────────────────────────────────────────────

async function handleSend(
  client: any,
  body: ContinuationRunRequest,
  userId: string,
  cors: Record<string, string>
) {
  const { run_id, org_id } = body;
  if (!run_id) {
    return jsonResponse({ error: "run_id is required" }, cors, 400);
  }

  // Verify run status
  const { data: run } = await client
    .from("term_continuation_runs")
    .select("*, terms!term_continuation_runs_current_term_id_fkey(name), next_term:terms!term_continuation_runs_next_term_id_fkey(name)")
    .eq("id", run_id)
    .eq("org_id", org_id)
    .single();

  if (!run) {
    return jsonResponse({ error: "Run not found" }, cors, 404);
  }

  if (run.status !== "draft") {
    return jsonResponse(
      { error: "Run must be in draft status to send" },
      cors,
      400
    );
  }

  // Get org details
  const { data: org } = await client
    .from("organisations")
    .select("name")
    .eq("id", org_id)
    .single();

  const orgName = org?.name || "Your Music Service";

  // Get responses with guardian details
  const { data: responses } = await client
    .from("term_continuation_responses")
    .select("id, student_id, guardian_id, lesson_summary, next_term_fee_minor, response_token")
    .eq("run_id", run_id)
    .eq("response", "pending");

  if (!responses || responses.length === 0) {
    return jsonResponse({ error: "No pending responses to send" }, cors, 400);
  }

  // Get student and guardian details
  const studentIds = [...new Set(responses.map((r: any) => r.student_id))];
  const guardianIds = [...new Set(responses.map((r: any) => r.guardian_id))];

  const { data: students } = await client
    .from("students")
    .select("id, first_name, last_name")
    .in("id", studentIds);

  const { data: guardians } = await client
    .from("guardians")
    .select("id, full_name, email")
    .in("id", guardianIds);

  const studentMap = new Map(
    (students || []).map((s: any) => [s.id, s])
  );
  const guardianMap = new Map(
    (guardians || []).map((g: any) => [g.id, g])
  );

  // Group responses by guardian for combined emails
  const byGuardian = new Map<string, any[]>();
  for (const r of responses) {
    if (!byGuardian.has(r.guardian_id)) {
      byGuardian.set(r.guardian_id, []);
    }
    byGuardian.get(r.guardian_id)!.push(r);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  let sentCount = 0;
  const failed: any[] = [];
  const now = new Date().toISOString();

  const currentTermName = (run.terms as any)?.name || "Current Term";
  const nextTermName = (run.next_term as any)?.name || "Next Term";
  const deadlineFormatted = new Date(
    run.notice_deadline + "T00:00:00Z"
  ).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  for (const [guardianId, guardianResponses] of byGuardian) {
    const guardian = guardianMap.get(guardianId);
    if (!guardian?.email) {
      failed.push({
        guardian_name: guardian?.full_name || "Unknown",
        email: null,
        error: "No email address",
      });
      continue;
    }

    // Build child details HTML
    let childrenHtml = "";
    for (const resp of guardianResponses) {
      const student = studentMap.get(resp.student_id);
      if (!student) continue;

      const lessons = resp.lesson_summary || [];
      let lessonsHtml = "";
      for (const l of lessons) {
        lessonsHtml += `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapeHtml(l.day)} at ${escapeHtml(l.time)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${escapeHtml(l.instrument || "Music")}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${l.lessons_next_term} lessons</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">&pound;${(l.rate_minor * l.lessons_next_term / 100).toFixed(2)}</td>
          </tr>`;
      }

      const feeFormatted = resp.next_term_fee_minor
        ? `£${(resp.next_term_fee_minor / 100).toFixed(2)}`
        : "";

      const continueUrl = `${FRONTEND_URL}/respond/continuation?token=${resp.response_token}&action=continuing`;
      const withdrawUrl = `${FRONTEND_URL}/respond/continuation?token=${resp.response_token}&action=withdrawing`;

      childrenHtml += `
        <div style="background: #f9fafb; padding: 16px 20px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px; color: #111;">${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px 12px; text-align: left;">Day/Time</th>
                <th style="padding: 8px 12px; text-align: left;">Instrument</th>
                <th style="padding: 8px 12px; text-align: left;">Lessons</th>
                <th style="padding: 8px 12px; text-align: left;">Fee</th>
              </tr>
            </thead>
            <tbody>${lessonsHtml}</tbody>
          </table>
          <p style="margin: 12px 0 0; font-weight: 600;">Total for ${escapeHtml(nextTermName)}: ${feeFormatted}</p>
          <div style="margin-top: 16px; text-align: center;">
            <a href="${continueUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 8px;">Confirm Continuing</a>
            <a href="${withdrawUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">Withdraw</a>
          </div>
        </div>`;
    }

    const subject = `${nextTermName} – Please confirm your child's music lessons`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333; margin-bottom: 20px;">Term Continuation</h1>
        <p>Dear ${escapeHtml(guardian.full_name)},</p>
        <p>As we approach the end of ${escapeHtml(currentTermName)}, we'd like to confirm whether your child will be continuing music lessons into ${escapeHtml(nextTermName)}.</p>
        <p><strong>Please respond by ${deadlineFormatted}.</strong></p>
        ${childrenHtml}
        <p style="font-size: 13px; color: #666; margin-top: 24px;">If you do not respond by the deadline${run.assumed_continuing ? ", your child will be automatically re-enrolled as per our terms and conditions" : ", your child's place may not be reserved"}.</p>
        <p>Thank you,<br>${escapeHtml(orgName)}</p>
      </div>`;

    // Log message
    await client.from("message_log").insert({
      org_id,
      channel: "email",
      subject,
      body: htmlContent,
      sender_user_id: userId,
      recipient_email: guardian.email,
      recipient_name: guardian.full_name,
      recipient_type: "guardian",
      recipient_id: guardianId,
      related_id: run_id,
      message_type: "continuation",
      status: resendApiKey ? "pending" : "logged",
    });

    // Send email
    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${orgName} <notifications@lessonloop.net>`,
            to: [guardian.email],
            subject,
            html: htmlContent,
          }),
        });

        if (emailResponse.ok) {
          sentCount++;
          // Update sent_at on response rows
          const responseIds = guardianResponses.map((r: any) => r.id);
          await client
            .from("term_continuation_responses")
            .update({ initial_sent_at: now })
            .in("id", responseIds);

          // Update message log
          await client
            .from("message_log")
            .update({ status: "sent", sent_at: now })
            .eq("related_id", run_id)
            .eq("recipient_id", guardianId)
            .eq("message_type", "continuation")
            .order("created_at", { ascending: false })
            .limit(1);
        } else {
          const result = await emailResponse.json();
          failed.push({
            guardian_name: guardian.full_name,
            email: guardian.email,
            error: result?.message || "Send failed",
          });
        }
      } catch (e: any) {
        failed.push({
          guardian_name: guardian.full_name,
          email: guardian.email,
          error: e.message,
        });
      }
    } else {
      sentCount++;
      const responseIds = guardianResponses.map((r: any) => r.id);
      await client
        .from("term_continuation_responses")
        .update({ initial_sent_at: now })
        .in("id", responseIds);
    }
  }

  // Update run status
  await client
    .from("term_continuation_runs")
    .update({ status: "sent", sent_at: now })
    .eq("id", run_id);

  return jsonResponse({ sent_count: sentCount, failed }, cors);
}

// ── Action: send_reminders ──────────────────────────────────────────────

async function handleSendReminders(
  client: any,
  body: ContinuationRunRequest,
  userId: string,
  cors: Record<string, string>
) {
  const { run_id, org_id } = body;
  if (!run_id) {
    return jsonResponse({ error: "run_id is required" }, cors, 400);
  }

  const { data: run } = await client
    .from("term_continuation_runs")
    .select("*, terms!term_continuation_runs_current_term_id_fkey(name), next_term:terms!term_continuation_runs_next_term_id_fkey(name)")
    .eq("id", run_id)
    .eq("org_id", org_id)
    .single();

  if (!run) {
    return jsonResponse({ error: "Run not found" }, cors, 404);
  }

  if (!["sent", "reminding"].includes(run.status)) {
    return jsonResponse(
      { error: "Run must be in sent or reminding status" },
      cors,
      400
    );
  }

  // Get pending responses
  const { data: pendingResponses } = await client
    .from("term_continuation_responses")
    .select("id, student_id, guardian_id, response_token, next_term_fee_minor, reminder_count")
    .eq("run_id", run_id)
    .eq("response", "pending");

  if (!pendingResponses || pendingResponses.length === 0) {
    return jsonResponse({ message: "No pending responses to remind" }, cors);
  }

  // Get details
  const studentIds = [...new Set(pendingResponses.map((r: any) => r.student_id))];
  const guardianIds = [...new Set(pendingResponses.map((r: any) => r.guardian_id))];

  const { data: students } = await client
    .from("students")
    .select("id, first_name, last_name")
    .in("id", studentIds);

  const { data: guardians } = await client
    .from("guardians")
    .select("id, full_name, email")
    .in("id", guardianIds);

  const { data: org } = await client
    .from("organisations")
    .select("name")
    .eq("id", org_id)
    .single();

  const studentMap = new Map((students || []).map((s: any) => [s.id, s]));
  const guardianMap = new Map((guardians || []).map((g: any) => [g.id, g]));
  const orgName = org?.name || "Your Music Service";
  const nextTermName = (run.next_term as any)?.name || "Next Term";

  const deadlineFormatted = new Date(
    run.notice_deadline + "T00:00:00Z"
  ).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Group by guardian
  const byGuardian = new Map<string, any[]>();
  for (const r of pendingResponses) {
    if (!byGuardian.has(r.guardian_id)) byGuardian.set(r.guardian_id, []);
    byGuardian.get(r.guardian_id)!.push(r);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  let sentCount = 0;
  const now = new Date().toISOString();

  for (const [guardianId, gResponses] of byGuardian) {
    const guardian = guardianMap.get(guardianId);
    if (!guardian?.email) continue;

    let childrenList = "";
    for (const resp of gResponses) {
      const student = studentMap.get(resp.student_id);
      if (!student) continue;
      const url = `${FRONTEND_URL}/respond/continuation?token=${resp.response_token}`;
      childrenList += `<li><strong>${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</strong> — <a href="${url}">Respond now</a></li>`;
    }

    const subject = `Reminder: Please confirm lessons for ${nextTermName}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">Reminder: Term Continuation</h1>
        <p>Dear ${escapeHtml(guardian.full_name)},</p>
        <p>We haven't yet received your response about continuing music lessons into ${escapeHtml(nextTermName)}.</p>
        <p><strong>The deadline is ${deadlineFormatted}.</strong></p>
        <ul>${childrenList}</ul>
        <p>Please click the link above to confirm or withdraw for each child.</p>
        <p>Thank you,<br>${escapeHtml(orgName)}</p>
      </div>`;

    await client.from("message_log").insert({
      org_id,
      channel: "email",
      subject,
      body: htmlContent,
      sender_user_id: userId,
      recipient_email: guardian.email,
      recipient_name: guardian.full_name,
      recipient_type: "guardian",
      recipient_id: guardianId,
      related_id: run_id,
      message_type: "continuation_reminder",
      status: resendApiKey ? "pending" : "logged",
    });

    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${orgName} <notifications@lessonloop.net>`,
            to: [guardian.email],
            subject,
            html: htmlContent,
          }),
        });

        if (emailResponse.ok) sentCount++;
      } catch {
        // Swallow individual send failures
      }
    } else {
      sentCount++;
    }

    // Update reminder tracking
    for (const resp of gResponses) {
      const newCount = (resp.reminder_count || 0) + 1;
      const updateData: any = { reminder_count: newCount };
      if (newCount === 1) updateData.reminder_1_sent_at = now;
      else if (newCount === 2) updateData.reminder_2_sent_at = now;

      await client
        .from("term_continuation_responses")
        .update(updateData)
        .eq("id", resp.id);
    }
  }

  // Update run status
  await client
    .from("term_continuation_runs")
    .update({ status: "reminding" })
    .eq("id", run_id);

  return jsonResponse({ reminded_count: sentCount }, cors);
}

// ── Action: process_deadline ────────────────────────────────────────────

async function handleProcessDeadline(
  client: any,
  body: ContinuationRunRequest,
  userId: string,
  cors: Record<string, string>
) {
  const { run_id, org_id } = body;
  if (!run_id) {
    return jsonResponse({ error: "run_id is required" }, cors, 400);
  }

  const { data: run } = await client
    .from("term_continuation_runs")
    .select("*")
    .eq("id", run_id)
    .eq("org_id", org_id)
    .single();

  if (!run) {
    return jsonResponse({ error: "Run not found" }, cors, 404);
  }

  if (!["sent", "reminding"].includes(run.status)) {
    return jsonResponse(
      { error: "Run must be in sent or reminding status to process deadline" },
      cors,
      400
    );
  }

  // Process pending responses
  const newResponse = run.assumed_continuing
    ? "assumed_continuing"
    : "no_response";

  const now = new Date().toISOString();

  await client
    .from("term_continuation_responses")
    .update({
      response: newResponse,
      response_at: now,
      response_method: "auto_deadline",
    })
    .eq("run_id", run_id)
    .eq("response", "pending");

  // Update run
  await client
    .from("term_continuation_runs")
    .update({
      status: "deadline_passed",
      deadline_passed_at: now,
    })
    .eq("id", run_id);

  const summary = await recalcSummary(client, run_id);

  // Audit
  await client.from("audit_log").insert({
    org_id,
    actor_user_id: userId,
    action: "continuation_run.deadline_processed",
    entity_type: "term_continuation_run",
    entity_id: run_id,
    after: {
      assumed_continuing: run.assumed_continuing,
      auto_response: newResponse,
      summary,
    },
  });

  return jsonResponse({ summary }, cors);
}
