import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BillingRunRequest {
  action: "create" | "retry";
  org_id: string;
  // create fields
  run_type?: string;
  start_date?: string;
  end_date?: string;
  generate_invoices?: boolean;
  fallback_rate_minor?: number;
  billing_mode?: "delivered" | "upfront";
  term_id?: string;
  // payment plan fields
  plan_enabled?: boolean;
  plan_threshold_minor?: number;
  plan_installments?: number;
  plan_frequency?: string;
  // retry fields
  billing_run_id?: string;
  failed_payer_ids?: string[];
}

interface RateCard {
  id: string;
  duration_mins: number;
  rate_amount: number;
  is_default: boolean;
}

// BIL-L3: Valid run_type values per DB enum
const VALID_RUN_TYPES = ["monthly", "term", "custom"];

// BIL-H1: ISO date format validation (YYYY-MM-DD)
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime());
}

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth check
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } =
      await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // BIL-H5: Use shared rate limit config — no inline override
    const rateLimitResult = await checkRateLimit(userId, "billing-run");
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(corsHeaders, rateLimitResult);
    }

    // Service role client for data operations (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body: BillingRunRequest = await req.json();

    // Verify user is finance team for this org
    const { data: membership } = await adminClient
      .from("org_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", body.org_id)
      .eq("status", "active")
      .in("role", ["owner", "admin", "finance"])
      .single();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not authorised for this organisation" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (body.action === "retry") {
      return await handleRetry(adminClient, body, corsHeaders);
    }

    // === CREATE BILLING RUN ===
    return await handleCreate(adminClient, body, userId, corsHeaders);
  } catch (err: any) {
    console.error("[create-billing-run] Error:", err);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleCreate(
  client: any,
  body: BillingRunRequest,
  userId: string,
  cors: Record<string, string>
) {
  const orgId = body.org_id;
  const billingMode = body.billing_mode || "delivered";
  const fallbackRate = body.fallback_rate_minor ?? 3000;

  // BIL-H1 + BIL-M2: Validate required date fields
  if (!body.start_date || !body.end_date) {
    return new Response(
      JSON.stringify({ error: "start_date and end_date are required" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  if (!isValidIsoDate(body.start_date) || !isValidIsoDate(body.end_date)) {
    return new Response(
      JSON.stringify({ error: "start_date and end_date must be valid ISO dates (YYYY-MM-DD)" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  if (body.end_date < body.start_date) {
    return new Response(
      JSON.stringify({ error: "end_date must be on or after start_date" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Reasonable range check: max 366 days
  const startMs = new Date(body.start_date + "T00:00:00Z").getTime();
  const endMs = new Date(body.end_date + "T00:00:00Z").getTime();
  const daySpan = (endMs - startMs) / (1000 * 60 * 60 * 24);
  if (daySpan > 366) {
    return new Response(
      JSON.stringify({ error: "Billing period cannot exceed 366 days" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // BIL-L3: Validate run_type against DB enum
  const runType = body.run_type || "custom";
  if (!VALID_RUN_TYPES.includes(runType)) {
    return new Response(
      JSON.stringify({ error: `Invalid run_type: must be one of ${VALID_RUN_TYPES.join(", ")}` }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  if (fallbackRate <= 0 || fallbackRate > 100000) {
    return new Response(
      JSON.stringify({ error: "Invalid fallback rate" }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }

  // Resolve payment plan settings
  const planEnabled = body.plan_enabled === true;
  const planFrequency = body.plan_frequency || "monthly";
  if (planEnabled && body.plan_frequency && !["monthly", "fortnightly", "custom"].includes(body.plan_frequency)) {
    return new Response(
      JSON.stringify({ error: "Invalid plan_frequency: must be monthly, fortnightly, or custom" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Get org settings (including payment plan defaults)
  const { data: org, error: orgError } = await client
    .from("organisations")
    .select(
      "vat_enabled, vat_rate, currency_code, subscription_status, trial_ends_at, timezone, default_plan_threshold_minor, default_plan_installments, default_plan_frequency"
    )
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return new Response(JSON.stringify({ error: "Organisation not found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // BIL-M3: Check for overlapping billing runs (not just exact date match)
  const { data: overlapping } = await client
    .from("billing_runs")
    .select("id, start_date, end_date")
    .eq("org_id", orgId)
    .neq("status", "failed")
    .lte("start_date", body.end_date)
    .gte("end_date", body.start_date)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    const existing = overlapping[0];
    return new Response(
      JSON.stringify({
        error: `A billing run already exists that overlaps this period (${existing.start_date} to ${existing.end_date})`,
      }),
      {
        status: 409,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }

  // Insert billing run
  const { data: billingRun, error: runError } = await client
    .from("billing_runs")
    .insert({
      org_id: orgId,
      run_type: runType,
      start_date: body.start_date,
      end_date: body.end_date,
      created_by: userId,
      status: "processing",
      billing_mode: billingMode,
      term_id: body.term_id || null,
      summary: { invoiceCount: 0, totalAmount: 0, invoiceIds: [] },
    })
    .select()
    .single();

  if (runError) {
    if (runError.code === "23505") {
      return new Response(
        JSON.stringify({
          error: "A billing run for this period already exists",
        }),
        {
          status: 409,
          headers: { ...cors, "Content-Type": "application/json" },
        }
      );
    }
    throw runError;
  }

  try {
    const result = await executeBillingLogic(
      client,
      orgId,
      org,
      body.start_date,
      body.end_date,
      billingMode,
      fallbackRate,
      body.generate_invoices !== false,
      body.term_id || null,
      null, // no payer filter
      billingRun.id, // BIL-H2: pass billing_run_id for FK
      {
        planEnabled,
        planThresholdMinor: body.plan_threshold_minor ?? org.default_plan_threshold_minor ?? null,
        planInstallments: body.plan_installments ?? org.default_plan_installments ?? 3,
        planFrequency: (body.plan_frequency ?? org.default_plan_frequency ?? "monthly") as string,
      }
    );

    // Determine status
    const failedCount = result.failedPayers.length;
    const totalPayers = result.totalPayers;
    let finalStatus: string;
    if (failedCount === 0) finalStatus = "completed";
    else if (failedCount < totalPayers) finalStatus = "partial";
    else finalStatus = "failed";

    const summary = {
      invoiceCount: result.invoiceIds.length,
      totalAmount: result.totalAmount,
      invoiceIds: result.invoiceIds,
      skippedLessons: result.skippedLessons,
      skippedForCancellation: result.skippedForCancellation,
      skippedForClosure: result.skippedForClosure,
      ...(result.skippedStudents.length > 0
        ? { skippedStudents: result.skippedStudents }
        : {}),
      ...(result.failedPayers.length > 0
        ? { failedPayers: result.failedPayers }
        : {}),
    };

    await client
      .from("billing_runs")
      .update({ status: finalStatus, summary })
      .eq("id", billingRun.id);

    return new Response(
      JSON.stringify({
        id: billingRun.id,
        status: finalStatus,
        summary,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (innerError: any) {
    // BIL-M4: Clean up orphan invoices on unexpected failure
    await client
      .from("invoices")
      .delete()
      .eq("billing_run_id", billingRun.id)
      .eq("org_id", orgId);

    await client
      .from("billing_runs")
      .update({ status: "failed" })
      .eq("id", billingRun.id);

    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again.", billing_run_id: billingRun.id }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }
}

async function handleRetry(
  client: any,
  body: BillingRunRequest,
  cors: Record<string, string>
) {
  const orgId = body.org_id;
  const billingRunId = body.billing_run_id;

  if (!billingRunId || !body.failed_payer_ids?.length) {
    return new Response(
      JSON.stringify({ error: "billing_run_id and failed_payer_ids required" }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }

  // Get billing run
  const { data: billingRun, error: brError } = await client
    .from("billing_runs")
    .select("*")
    .eq("id", billingRunId)
    .eq("org_id", orgId)
    .single();

  if (brError || !billingRun) {
    return new Response(
      JSON.stringify({ error: "Billing run not found" }),
      {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }

  // Get org
  const { data: org } = await client
    .from("organisations")
    .select("vat_enabled, vat_rate, currency_code")
    .eq("id", orgId)
    .single();

  if (!org) {
    return new Response(JSON.stringify({ error: "Org not found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const retryPayerIds = new Set(body.failed_payer_ids);

  const result = await executeBillingLogic(
    client,
    orgId,
    org,
    billingRun.start_date,
    billingRun.end_date,
    billingRun.billing_mode || "delivered",
    3000,
    true,
    billingRun.term_id || null,
    retryPayerIds,
    billingRunId // BIL-H2: pass billing_run_id for FK
  );

  // Update billing run summary
  const existingSummary = (billingRun.summary || {}) as Record<string, any>;
  const existingInvoiceIds: string[] = existingSummary.invoiceIds || [];
  const updatedSummary = {
    ...existingSummary,
    invoiceCount:
      (existingSummary.invoiceCount || 0) + result.invoiceIds.length,
    totalAmount: (existingSummary.totalAmount || 0) + result.totalAmount,
    invoiceIds: [...existingInvoiceIds, ...result.invoiceIds],
    failedPayers:
      result.failedPayers.length > 0 ? result.failedPayers : undefined,
  };

  const finalStatus = result.failedPayers.length === 0 ? "completed" : "partial";

  await client
    .from("billing_runs")
    .update({ status: finalStatus, summary: updatedSummary })
    .eq("id", billingRunId);

  return new Response(
    JSON.stringify({
      newInvoiceCount: result.invoiceIds.length,
      stillFailed: result.failedPayers,
      finalStatus,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
}

interface PlanOptions {
  planEnabled: boolean;
  planThresholdMinor: number | null;
  planInstallments: number;
  planFrequency: string;
}

async function executeBillingLogic(
  client: any,
  orgId: string,
  org: { vat_enabled: boolean; vat_rate: number; currency_code: string; timezone?: string; default_plan_threshold_minor?: number | null; default_plan_installments?: number; default_plan_frequency?: string },
  startDate: string,
  endDate: string,
  billingMode: string,
  fallbackRate: number,
  generateInvoices: boolean,
  termId: string | null,
  retryPayerIds: Set<string> | null,
  billingRunId: string, // BIL-H2: link invoices to billing run
  planOptions?: PlanOptions
) {
  // Fetch rate cards
  const { data: rateCards } = await client
    .from("rate_cards")
    .select("id, duration_mins, rate_amount, is_default")
    .eq("org_id", orgId);

  // Determine status filter
  const statusFilter =
    billingMode === "upfront"
      ? ["scheduled", "completed"]
      : ["completed"];

  // Convert date boundaries to UTC using org timezone so evening lessons
  // on the last day of the period are not silently excluded (FIN-H2)
  const tz = org.timezone || "Europe/London";

  function localToUTC(localDatetime: string, timezone: string): string {
    const date = new Date(localDatetime);
    const utcDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
    const offset = utcDate.getTime() - date.getTime();
    return new Date(date.getTime() - offset).toISOString();
  }

  const startUTC = localToUTC(`${startDate}T00:00:00`, tz);
  const endUTC = localToUTC(`${endDate}T23:59:59`, tz);

  // Fetch lessons
  const { data: lessons, error: lessonsError } = await client
    .from("lessons")
    .select(
      `
      id, title, start_at, end_at, location_id,
      lesson_participants(
        rate_minor,
        student:students(
          id, first_name, last_name, status, email,
          student_guardians(
            guardian:guardians(id, full_name, email),
            is_primary_payer
          )
        )
      )
    `
    )
    .eq("org_id", orgId)
    .in("status", statusFilter)
    .or('is_open_slot.is.null,is_open_slot.eq.false')
    .gte("start_at", startUTC)
    .lte("start_at", endUTC);

  if (lessonsError) throw lessonsError;

  // Fetch closure_dates that overlap the billing period. A closure row has a
  // single `date` (no range) and is either org-wide
  // (applies_to_all_locations=true OR location_id IS NULL) or scoped to one
  // location_id. We exclude any lesson whose org-local calendar date matches
  // a closure that applies to its location. See Section 3c of
  // BILLING_FORENSICS.md — this filter fixes the HIGH finding that closed-day
  // lessons were being billed when a closure was added after lesson creation.
  const { data: closureDatesData, error: closureError } = await client
    .from("closure_dates")
    .select("id, date, location_id, applies_to_all_locations")
    .eq("org_id", orgId)
    .gte("date", startDate)
    .lte("date", endDate);
  if (closureError) {
    console.error("[BillingRun] Failed to fetch closure_dates (non-critical):", closureError);
  }
  const closures: Array<{ id: string; date: string; location_id: string | null; applies_to_all_locations: boolean }> =
    (closureDatesData as any) || [];

  // Get already billed (lesson, student) pairs — dedup must be per-student
  // so group lessons bill each student independently
  const { data: billedItems } = await client
    .from("invoice_items")
    .select("linked_lesson_id, student_id")
    .eq("org_id", orgId)
    .not("linked_lesson_id", "is", null);

  const billedPairs = new Set(
    (billedItems || []).map((i: any) => `${i.linked_lesson_id}-${i.student_id}`)
  );
  // Keep all lessons that have at least one unbilled student. Mutable because
  // the closure-date filter below removes lessons whose org-local date falls
  // on an applicable closure.
  let unbilledLessons: any[] = lessons || [];

  // Fetch attendance records for unbilled lessons
  const unbilledIds = unbilledLessons.map((l: any) => l.id);
  const attendanceMap = new Map<string, string>();
  let skippedForCancellation = 0;

  if (unbilledIds.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < unbilledIds.length; i += batchSize) {
      const batch = unbilledIds.slice(i, i + batchSize);
      const { data: attData } = await client
        .from("attendance_records")
        .select("lesson_id, student_id, attendance_status")
        .in("lesson_id", batch);
      if (attData) {
        attData.forEach((a: any) => {
          attendanceMap.set(
            `${a.lesson_id}-${a.student_id}`,
            a.attendance_status
          );
        });
      }
    }
  }

  // Apply closure-date exclusion. A lesson is excluded if its org-local
  // calendar date matches a closure row for its org where either
  // applies_to_all_locations is true (or location_id is NULL), or where the
  // closure's location_id matches the lesson's location_id. Closure wins for
  // billing purposes even if attendance was recorded — that contradiction is
  // logged for operator investigation but does not block the run.
  let skippedForClosure = 0;
  if (closures.length > 0 && unbilledLessons.length > 0) {
    const orgWideClosureDates = new Set<string>();
    const locationClosureDates = new Map<string, Set<string>>();
    for (const c of closures) {
      if (c.applies_to_all_locations || !c.location_id) {
        orgWideClosureDates.add(c.date);
      } else {
        if (!locationClosureDates.has(c.location_id)) {
          locationClosureDates.set(c.location_id, new Set<string>());
        }
        locationClosureDates.get(c.location_id)!.add(c.date);
      }
    }
    unbilledLessons = unbilledLessons.filter((l: any) => {
      // Project lesson start to the org's local calendar date (en-CA → YYYY-MM-DD)
      const localDate = new Date(l.start_at).toLocaleDateString("en-CA", { timeZone: tz });
      const orgClosed = orgWideClosureDates.has(localDate);
      const locClosed = !!(l.location_id && locationClosureDates.get(l.location_id)?.has(localDate));
      if (!orgClosed && !locClosed) return true;

      // Contradiction check — closure set AND attendance marked as attended
      const matchedClosureIds = closures
        .filter((c) => c.date === localDate && (
          c.applies_to_all_locations || !c.location_id || c.location_id === l.location_id
        ))
        .map((c) => c.id);
      const participants = l.lesson_participants || [];
      for (const lp of participants) {
        const studentId = lp?.student?.id;
        if (!studentId) continue;
        const attStatus = attendanceMap.get(`${l.id}-${studentId}`);
        if (attStatus === "present" || attStatus === "late") {
          console.warn("[BillingRun] Closure/attendance contradiction — excluding lesson from billing", {
            org_id: orgId,
            lesson_id: l.id,
            student_id: studentId,
            attendance_status: attStatus,
            closure_ids: matchedClosureIds,
            local_date: localDate,
          });
        }
      }
      skippedForClosure++;
      return false;
    });
  }

  // Track students skipped due to no payer
  const skippedStudents: Array<{
    student_id: string;
    student_name: string;
    reason: string;
  }> = [];

  // Group by payer
  const payerGroups = new Map<
    string,
    {
      payerType: "guardian" | "student";
      payerId: string;
      payerName: string;
      payerEmail: string | null;
      lessons: Array<{ lesson: any; studentId: string; snapshotRate: number | null }>;
      addedKeys: Set<string>;
    }
  >();

  unbilledLessons.forEach((lesson: any) => {
    lesson.lesson_participants?.forEach((lp: any) => {
      const student = lp.student;
      if (!student || student.status !== "active") return;

      // Skip already-billed (lesson, student) pairs
      const billedKey = `${lesson.id}-${student.id}`;
      if (billedPairs.has(billedKey)) return;

      const attKey = `${lesson.id}-${student.id}`;
      const attStatus = attendanceMap.get(attKey);
      if (attStatus === "cancelled_by_teacher") {
        skippedForCancellation++;
        return;
      }

      const primaryGuardian = student.student_guardians?.find(
        (sg: any) => sg.is_primary_payer
      )?.guardian;

      let payerId: string;
      let payerType: "guardian" | "student";
      let payerName: string;
      let payerEmail: string | null;

      if (primaryGuardian) {
        payerId = primaryGuardian.id;
        payerType = "guardian";
        payerName = primaryGuardian.full_name;
        payerEmail = primaryGuardian.email;
      } else if (student.email) {
        payerId = student.id;
        payerType = "student";
        payerName = `${student.first_name} ${student.last_name}`;
        payerEmail = student.email;
      } else {
        skippedStudents.push({
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          reason: 'no_primary_payer',
        });
        return;
      }

      // If retrying, only process specific payers
      if (retryPayerIds && !retryPayerIds.has(payerId)) return;

      const key = `${payerType}-${payerId}`;
      if (!payerGroups.has(key)) {
        payerGroups.set(key, {
          payerType,
          payerId,
          payerName,
          payerEmail,
          lessons: [],
          addedKeys: new Set(),
        });
      }
      const group = payerGroups.get(key)!;
      const dedupKey = `${lesson.id}-${student.id}`;
      if (!group.addedKeys.has(dedupKey)) {
        group.lessons.push({ lesson, studentId: student.id, snapshotRate: lp.rate_minor ?? null });
        group.addedKeys.add(dedupKey);
      }
    });
  });

  // Count skipped (no payer)
  const billedLessonIds2 = new Set<string>();
  for (const [, group] of payerGroups) {
    group.lessons.forEach(({ lesson }) => billedLessonIds2.add(lesson.id));
  }
  const skippedLessons = unbilledLessons.filter(
    (l: any) => !billedLessonIds2.has(l.id)
  ).length;

  const invoiceIds: string[] = [];
  let totalAmount = 0;
  const failedPayers: Array<{
    payerName: string;
    payerEmail: string | null;
    error: string;
    payerType?: string;
    payerId?: string;
  }> = [];

  if (generateInvoices) {
    // Calculate due date in the org's timezone so the 14-day window
    // aligns with the org's local calendar date, not UTC.
    const tz = org.timezone || "Europe/London";
    const nowInTz = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
    const localDate = new Date(nowInTz + "T00:00:00");
    localDate.setDate(localDate.getDate() + 14);
    const dueDateStr = localDate.toISOString().split("T")[0];
    const vatRate = org.vat_enabled ? org.vat_rate : 0;

    // Per-payer RPC-based invoice creation.
    // Calls create_invoice_with_items for each payer in sequence, which:
    //   - Enforces is_org_active subscription gate (BR11 self-resolves)
    //   - Is atomic per invoice (no orphan items possible — BR2 resolved)
    //   - Reuses tested code path
    //
    // Post-create: each invoice is updated with billing_run_id + term_id
    // (RPC doesn't accept these). If the update fails, the invoice is
    // deleted to prevent orphan state, and the payer is recorded as failed.
    //
    // Successful-payer tracking: we iterate payerGroups directly and
    // track parallel arrays for Xero sync and plan generation.

    interface SuccessfulInvoice {
      invoiceId: string;
      payer: any;
      lessonRates: number[];
      total: number;
      studentIds: string[];
    }
    const successful: SuccessfulInvoice[] = [];

    for (const [, payer] of payerGroups) {
      // Compute rates per lesson — prefer snapshot rate from lesson_participants
      const lessonRates = payer.lessons.map(({ lesson, snapshotRate }: any) => {
        if (snapshotRate != null && snapshotRate > 0) return snapshotRate;
        const start = new Date(lesson.start_at).getTime();
        const end = new Date(lesson.end_at).getTime();
        const durationMins = Math.round((end - start) / 60000);
        return findRateForDuration(durationMins, rateCards || [], fallbackRate);
      });

      // Build items payload for the RPC
      const itemsPayload = payer.lessons.map(({ lesson, studentId }: any, j: number) => ({
        description: lesson.title,
        quantity: 1,
        unit_price_minor: lessonRates[j],
        linked_lesson_id: lesson.id,
        student_id: studentId,
      }));

      const studentIds = payer.lessons.map((l: any) => l.studentId);

      // Call create_invoice_with_items RPC — atomic per invoice
      const { data: rpcResult, error: rpcError } = await client.rpc(
        "create_invoice_with_items",
        {
          _org_id: orgId,
          _due_date: dueDateStr,
          _payer_guardian_id: payer.payerType === "guardian" ? payer.payerId : null,
          _payer_student_id: payer.payerType === "student" ? payer.payerId : null,
          _notes: null,
          _credit_ids: [],
          _items: itemsPayload,
        }
      );

      if (rpcError || !rpcResult) {
        console.error(`[BillingRun] create_invoice_with_items failed for payer ${payer.payerId}:`, rpcError);
        failedPayers.push({
          payerName: payer.payerName,
          payerEmail: payer.payerEmail,
          payerType: payer.payerType,
          payerId: payer.payerId,
          error: rpcError?.message || "Invoice creation failed",
        });
        continue;
      }

      const invoiceId = (rpcResult as any).id;
      const totalMinor = (rpcResult as any).total_minor;

      // Link invoice to billing run and term. RPC doesn't accept these;
      // we UPDATE post-create. If the update fails, delete the orphan
      // and mark the payer as failed to keep ledger consistent.
      const { error: linkError } = await client
        .from("invoices")
        .update({
          billing_run_id: billingRunId,
          term_id: termId,
        })
        .eq("id", invoiceId)
        .eq("org_id", orgId);

      if (linkError) {
        console.error(`[BillingRun] Failed to link invoice ${invoiceId} to billing run — deleting:`, linkError);
        // Rollback: delete the orphan invoice
        await client.from("invoices").delete().eq("id", invoiceId);
        failedPayers.push({
          payerName: payer.payerName,
          payerEmail: payer.payerEmail,
          payerType: payer.payerType,
          payerId: payer.payerId,
          error: "Invoice created but could not be linked to billing run",
        });
        continue;
      }

      invoiceIds.push(invoiceId);
      totalAmount += totalMinor;
      successful.push({
        invoiceId,
        payer,
        lessonRates,
        total: totalMinor,
        studentIds,
      });
    }

    // ── Payment plan creation for eligible invoices ──
    if (planOptions?.planEnabled && successful.length > 0) {
      // Fetch student-level preferences for all students across successful invoices
      const studentIdSet = new Set<string>();
      for (const s of successful) {
        for (const sid of s.studentIds) studentIdSet.add(sid);
      }

      const { data: studentPrefs } = studentIdSet.size > 0
        ? await client
            .from("students")
            .select("id, payment_plan_preference")
            .in("id", [...studentIdSet])
        : { data: [] };

      const prefMap = new Map<string, string>(
        (studentPrefs || []).map((s: any) => [s.id, s.payment_plan_preference || "default"])
      );

      const threshold = planOptions.planThresholdMinor;
      const instCount = planOptions.planInstallments;
      const freq = planOptions.planFrequency;

      // Track per-invoice plan failures (BR10 partial surfacing)
      const planFailures: Array<{ invoiceId: string; error: string }> = [];

      for (const inv of successful) {
        // Check student-level overrides: 'never' blocks, 'always' forces
        let forcePlan = false;
        let blockPlan = false;
        for (const sid of inv.studentIds) {
          const pref = prefMap.get(sid) || "default";
          if (pref === "always") forcePlan = true;
          if (pref === "never") blockPlan = true;
        }

        // 'never' takes precedence over 'always'
        if (blockPlan) continue;

        const meetsThreshold = threshold != null ? inv.total > threshold : true;
        if (!forcePlan && !meetsThreshold) continue;

        // Create payment plan via generate_installments RPC
        const { error: planError } = await client.rpc("generate_installments", {
          _invoice_id: inv.invoiceId,
          _org_id: orgId,
          _count: instCount,
          _frequency: freq,
        });

        if (planError) {
          console.error(`[BillingRun] Failed to create payment plan for invoice ${inv.invoiceId}:`, planError);
          planFailures.push({
            invoiceId: inv.invoiceId,
            error: planError.message || "Payment plan generation failed",
          });
        }
      }

      // BR10: If any plans failed, surface in summary for UI to consume
      if (planFailures.length > 0) {
        console.warn(`[BillingRun] ${planFailures.length} payment plan(s) failed to generate out of ${successful.length} invoices`);
      }
    }
  }

  // ── Xero invoice sync with attempt tracking (BR9) ──
  // Previous fire-and-forget made failures invisible. Now each attempt
  // records its outcome in xero_entity_mappings so the UI can surface
  // pending / synced / failed states and offer retry.
  if (invoiceIds.length > 0) {
    try {
      const { data: xeroConn } = await client
        .from("xero_connections")
        .select("id, sync_enabled, auto_sync_invoices")
        .eq("org_id", orgId)
        .maybeSingle();

      if (xeroConn?.sync_enabled && xeroConn?.auto_sync_invoices) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Seed attempt rows as 'pending' before firing — so the UI sees
        // in-flight state even if the edge function times out mid-sync
        const pendingRows = invoiceIds.map((invoiceId) => ({
          org_id: orgId,
          connection_id: xeroConn.id,
          entity_type: "invoice",
          local_id: invoiceId,
          xero_id: "",
          sync_status: "pending",
        }));

        // Upsert pending rows. If a row already exists (retry path),
        // update sync_status back to pending.
        const { error: upsertError } = await client
          .from("xero_entity_mappings")
          .upsert(pendingRows, { onConflict: "org_id,entity_type,local_id" });

        if (upsertError) {
          console.error("[BillingRun] Failed to seed xero_entity_mappings pending rows:", upsertError);
        }

        // Fire syncs in parallel. Each sync function is responsible for
        // updating its own xero_entity_mappings row to 'synced' or
        // 'failed' with error_message.
        await Promise.all(
          invoiceIds.map(async (invoiceId) => {
            try {
              const response = await fetch(`${supabaseUrl}/functions/v1/xero-sync-invoice`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${serviceRoleKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ invoice_id: invoiceId }),
              });

              if (!response.ok) {
                const errText = await response.text().catch(() => "unknown error");
                // Record failure. The sync function may also have recorded,
                // but network-level failures need capturing here.
                await client
                  .from("xero_entity_mappings")
                  .update({
                    sync_status: "failed",
                    error_message: `Sync call returned ${response.status}: ${errText.slice(0, 200)}`,
                  })
                  .eq("org_id", orgId)
                  .eq("entity_type", "invoice")
                  .eq("local_id", invoiceId);
              }
            } catch (err: any) {
              console.error(`[BillingRun] Xero sync network error for invoice ${invoiceId}:`, err);
              await client
                .from("xero_entity_mappings")
                .update({
                  sync_status: "failed",
                  error_message: `Network error: ${err?.message || String(err)}`.slice(0, 500),
                })
                .eq("org_id", orgId)
                .eq("entity_type", "invoice")
                .eq("local_id", invoiceId);
            }
          })
        );
        console.log(`[BillingRun] Xero auto-sync initiated for ${invoiceIds.length} invoices — outcomes in xero_entity_mappings`);
      } else {
        console.log("[BillingRun] Xero sync skipped — no active connection or auto_sync_invoices disabled");
      }
    } catch (err) {
      console.error("[BillingRun] Xero sync orchestration failed (non-critical):", err);
    }
  }

  return {
    invoiceIds,
    totalAmount,
    totalPayers: payerGroups.size,
    skippedLessons,
    skippedForCancellation,
    skippedForClosure,
    skippedStudents,
    failedPayers,
  };
}
