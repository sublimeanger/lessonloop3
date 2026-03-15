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

    // Rate limiting: 3 billing runs per 5 minutes per user
    const rateLimitResult = await checkRateLimit(userId, "billing-run", {
      maxRequests: 3,
      windowMinutes: 5,
    });
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

  if (fallbackRate <= 0 || fallbackRate > 100000) {
    return new Response(
      JSON.stringify({ error: "Invalid fallback rate" }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }

  // Get org settings
  const { data: org, error: orgError } = await client
    .from("organisations")
    .select(
      "vat_enabled, vat_rate, currency_code, subscription_status, trial_ends_at, timezone"
    )
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return new Response(JSON.stringify({ error: "Organisation not found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Insert billing run
  const { data: billingRun, error: runError } = await client
    .from("billing_runs")
    .insert({
      org_id: orgId,
      run_type: body.run_type || "manual",
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
      body.start_date!,
      body.end_date!,
      billingMode,
      fallbackRate,
      body.generate_invoices !== false,
      body.term_id || null,
      null // no payer filter
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
    retryPayerIds
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

async function executeBillingLogic(
  client: any,
  orgId: string,
  org: { vat_enabled: boolean; vat_rate: number; currency_code: string; timezone?: string },
  startDate: string,
  endDate: string,
  billingMode: string,
  fallbackRate: number,
  generateInvoices: boolean,
  termId: string | null,
  retryPayerIds: Set<string> | null
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

  // Fetch lessons
  const { data: lessons, error: lessonsError } = await client
    .from("lessons")
    .select(
      `
      id, title, start_at, end_at,
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
    .gte("start_at", startDate)
    .lte("start_at", endDate);

  if (lessonsError) throw lessonsError;

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
  // Keep all lessons that have at least one unbilled student
  const unbilledLessons = lessons || [];

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

    // Pre-compute all invoice rows and their associated items
    const allInvoiceRows: any[] = [];
    const payerItemsMap: Array<{ payer: any; lessonRates: number[]; total: number }> = [];

    for (const [, payer] of payerGroups) {
      const lessonRates = payer.lessons.map(({ lesson, snapshotRate }: any) => {
        // Prefer the rate snapshotted at lesson creation to avoid
        // retroactive billing when rate cards change mid-term
        if (snapshotRate != null && snapshotRate > 0) return snapshotRate;
        const start = new Date(lesson.start_at).getTime();
        const end = new Date(lesson.end_at).getTime();
        const durationMins = Math.round((end - start) / 60000);
        return findRateForDuration(durationMins, rateCards || [], fallbackRate);
      });

      const subtotal = lessonRates.reduce((s: number, r: number) => s + r, 0);
      // NOTE: VAT is calculated on invoice subtotal, not per-item.
      // Per-item VAT display would require additional rounding logic.
      const taxMinor = Math.round(subtotal * (vatRate / 100));
      const total = subtotal + taxMinor;

      allInvoiceRows.push({
        org_id: orgId,
        invoice_number: "",
        due_date: dueDateStr,
        payer_guardian_id: payer.payerType === "guardian" ? payer.payerId : null,
        payer_student_id: payer.payerType === "student" ? payer.payerId : null,
        subtotal_minor: subtotal,
        tax_minor: taxMinor,
        total_minor: total,
        vat_rate: vatRate,
        currency_code: org.currency_code,
        status: "draft",
        term_id: termId,
      });
      payerItemsMap.push({ payer, lessonRates, total });
    }

    if (allInvoiceRows.length > 0) {
      // Batch insert all invoices
      const { data: invoices, error: invoiceError } = await client
        .from("invoices")
        .insert(allInvoiceRows)
        .select("id");

      if (invoiceError) {
        console.error("[BillingRun] Batch invoice insert failed:", invoiceError);
        for (const { payer } of payerItemsMap) {
          failedPayers.push({
            payerName: payer.payerName,
            payerEmail: payer.payerEmail,
            payerType: payer.payerType,
            payerId: payer.payerId,
            error: invoiceError.message || "Invoice creation failed",
          });
        }
      } else if (invoices) {
        // Batch insert all invoice items
        const allItems: any[] = [];
        for (let i = 0; i < invoices.length; i++) {
          const inv = invoices[i];
          const { payer, lessonRates, total } = payerItemsMap[i];
          invoiceIds.push(inv.id);
          totalAmount += total;
          for (let j = 0; j < payer.lessons.length; j++) {
            const { lesson, studentId } = payer.lessons[j];
            allItems.push({
              invoice_id: inv.id,
              org_id: orgId,
              description: lesson.title,
              quantity: 1,
              unit_price_minor: lessonRates[j],
              amount_minor: lessonRates[j],
              linked_lesson_id: lesson.id,
              student_id: studentId,
            });
          }
        }

        if (allItems.length > 0) {
          const { error: itemsError } = await client
            .from("invoice_items")
            .insert(allItems);
          if (itemsError) {
            console.error("[BillingRun] Batch items insert failed:", itemsError);
            // Clean up orphaned invoices that have no items
            const orphanIds = invoiceIds.splice(0, invoiceIds.length);
            if (orphanIds.length > 0) {
              await client.from('invoices').delete().in('id', orphanIds);
            }
            totalAmount = 0;
            for (const { payer } of payerItemsMap) {
              failedPayers.push({
                payerName: payer.payerName,
                payerEmail: payer.payerEmail,
                payerType: payer.payerType,
                payerId: payer.payerId,
                error: 'Failed to create invoice items',
              });
            }
          }
        }
      }
    }
  }

  return {
    invoiceIds,
    totalAmount,
    totalPayers: payerGroups.size,
    skippedLessons,
    skippedForCancellation,
    skippedStudents,
    failedPayers,
  };
}
