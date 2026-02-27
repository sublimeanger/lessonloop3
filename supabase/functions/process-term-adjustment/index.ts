import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
} from "../_shared/cors.ts";

// ── Interfaces ──────────────────────────────────────────────────────────

interface TermAdjustmentRequest {
  action: "preview" | "confirm";
  org_id: string;
  adjustment_type: "withdrawal" | "day_change";
  student_id: string;
  recurrence_id: string;
  effective_date: string; // YYYY-MM-DD
  term_id?: string;
  // day_change fields
  new_day_of_week?: number; // 0-6, 0=Sunday
  new_start_time?: string; // HH:MM
  new_teacher_id?: string;
  new_location_id?: string;
  // confirm-only fields
  adjustment_id?: string;
  generate_credit_note?: boolean;
  manual_rate_minor?: number;
  notes?: string;
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

/** Generate all dates for a given day-of-week within [start, end]. */
function generateDatesForDay(
  startDateStr: string,
  endDateStr: string,
  dayOfWeek: number
): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr + "T00:00:00Z");
  const end = new Date(endDateStr + "T23:59:59Z");

  // Find first occurrence of dayOfWeek on or after start
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
    const body: TermAdjustmentRequest = await req.json();

    // Verify user role
    const { data: membership } = await adminClient
      .from("org_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", body.org_id)
      .eq("status", "active")
      .in("role", ["owner", "admin", "finance"])
      .single();

    if (!membership) {
      return jsonResponse(
        { error: "Not authorised for this organisation" },
        corsHeaders,
        403
      );
    }

    if (body.action === "preview") {
      return await handlePreview(adminClient, body, userId, corsHeaders);
    } else if (body.action === "confirm") {
      return await handleConfirm(adminClient, body, userId, corsHeaders);
    }

    return jsonResponse({ error: "Invalid action" }, corsHeaders, 400);
  } catch (err: any) {
    console.error("[process-term-adjustment] Error:", err);
    return jsonResponse(
      { error: err.message || "Internal error" },
      corsHeaders,
      500
    );
  }
});

// ── Preview ─────────────────────────────────────────────────────────────

async function handlePreview(
  client: any,
  body: TermAdjustmentRequest,
  userId: string,
  cors: Record<string, string>
) {
  const orgId = body.org_id;
  const effectiveDate = body.effective_date;

  // 1. Resolve term
  let term: any = null;
  if (body.term_id) {
    const { data } = await client
      .from("terms")
      .select("*")
      .eq("id", body.term_id)
      .eq("org_id", orgId)
      .single();
    term = data;
  } else {
    const { data } = await client
      .from("terms")
      .select("*")
      .eq("org_id", orgId)
      .lte("start_date", effectiveDate)
      .gte("end_date", effectiveDate)
      .single();
    term = data;
  }

  // Term is optional — if no term, use effective_date + 90 days as range
  const termEndDate = term?.end_date ||
    new Date(
      new Date(effectiveDate).getTime() + 90 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];

  // 2. Get recurrence rule
  const { data: recurrence, error: recError } = await client
    .from("recurrence_rules")
    .select("*")
    .eq("id", body.recurrence_id)
    .single();

  if (recError || !recurrence) {
    return jsonResponse(
      { error: "Lesson series not found" },
      cors,
      404
    );
  }

  // 3. Count remaining lessons
  const { data: remainingLessons, error: lessonsError } = await client
    .from("lessons")
    .select("id, start_at, end_at, title, teacher_user_id, location_id, room_id, lesson_type, is_online")
    .eq("recurrence_id", body.recurrence_id)
    .eq("org_id", orgId)
    .gte("start_at", effectiveDate + "T00:00:00Z")
    .lte("start_at", termEndDate + "T23:59:59Z")
    .eq("status", "scheduled")
    .order("start_at", { ascending: true });

  if (lessonsError) throw lessonsError;

  if (!remainingLessons || remainingLessons.length === 0) {
    return jsonResponse(
      { error: "No remaining scheduled lessons in this series" },
      cors,
      400
    );
  }

  const originalRemaining = remainingLessons.length;
  const originalDates = remainingLessons.map(
    (l: any) => l.start_at.split("T")[0]
  );

  // Determine original day/time from first lesson
  const firstLesson = remainingLessons[0];
  const firstLessonDate = new Date(firstLesson.start_at);
  const originalDayOfWeek = DAY_NAMES[firstLessonDate.getUTCDay()];
  const originalTime = firstLesson.start_at.substring(11, 16); // HH:MM

  // 4. Calculate lesson duration
  const durationMs =
    new Date(firstLesson.end_at).getTime() -
    new Date(firstLesson.start_at).getTime();
  const durationMins = Math.round(durationMs / 60000);

  // 5. Get rate
  const { data: student } = await client
    .from("students")
    .select("id, first_name, last_name, default_rate_card_id")
    .eq("id", body.student_id)
    .single();

  if (!student) {
    return jsonResponse({ error: "Student not found" }, cors, 404);
  }

  const { data: rateCards } = await client
    .from("rate_cards")
    .select("id, duration_mins, rate_amount, is_default")
    .eq("org_id", orgId);

  let lessonRate: number;
  if (body.manual_rate_minor != null) {
    lessonRate = body.manual_rate_minor;
  } else if (student.default_rate_card_id && rateCards) {
    const studentCard = rateCards.find(
      (rc: any) => rc.id === student.default_rate_card_id
    );
    lessonRate = studentCard
      ? studentCard.rate_amount
      : findRateForDuration(durationMins, rateCards || []);
  } else {
    lessonRate = findRateForDuration(durationMins, rateCards || []);
  }

  // 6. Get org settings for VAT + currency
  const { data: org } = await client
    .from("organisations")
    .select("vat_enabled, vat_rate, currency_code")
    .eq("id", orgId)
    .single();

  const currencyCode = org?.currency_code || "GBP";
  const vatEnabled = org?.vat_enabled || false;
  const vatRate = org?.vat_rate || 0;

  // 7. Day change: generate new dates
  let newDayName: string | null = null;
  let newTime: string | null = null;
  let newLessonDates: string[] = [];
  let newLessonCount = 0;
  let lessonsDifference = originalRemaining;

  if (body.adjustment_type === "day_change") {
    if (body.new_day_of_week == null) {
      return jsonResponse(
        { error: "new_day_of_week is required for day_change" },
        cors,
        400
      );
    }

    newDayName = DAY_NAMES[body.new_day_of_week];
    newTime = body.new_start_time || originalTime;

    // Generate all possible dates for the new day
    const allNewDates = generateDatesForDay(
      effectiveDate,
      termEndDate,
      body.new_day_of_week
    );

    // Filter out closure dates
    const targetLocationId =
      body.new_location_id || firstLesson.location_id;
    const { data: closureDates } = await client
      .from("closure_dates")
      .select("date, location_id, applies_to_all_locations")
      .eq("org_id", orgId)
      .gte("date", effectiveDate)
      .lte("date", termEndDate);

    const closureDateSet = new Set<string>();
    if (closureDates) {
      for (const cd of closureDates) {
        if (
          cd.applies_to_all_locations ||
          !targetLocationId ||
          cd.location_id === targetLocationId
        ) {
          closureDateSet.add(cd.date);
        }
      }
    }

    newLessonDates = allNewDates.filter((d) => !closureDateSet.has(d));
    newLessonCount = newLessonDates.length;
    lessonsDifference = originalRemaining - newLessonCount;
  }
  // For withdrawal, lessonsDifference = originalRemaining (all credited)

  // 8. Financial calc
  const adjustmentAmountMinor = lessonsDifference * lessonRate;
  const vatAmountMinor = vatEnabled
    ? Math.round(adjustmentAmountMinor * vatRate / 100)
    : 0;
  const totalAdjustmentMinor = adjustmentAmountMinor + vatAmountMinor;

  // 9. Find related term invoice
  let existingTermInvoice: any = null;
  if (term) {
    // Find guardian for this student
    const { data: guardianLinks } = await client
      .from("student_guardians")
      .select("guardian_id, is_primary_payer")
      .eq("student_id", body.student_id);

    const primaryGuardian = guardianLinks?.find(
      (sg: any) => sg.is_primary_payer
    );

    if (primaryGuardian) {
      const { data: invoice } = await client
        .from("invoices")
        .select("id, invoice_number, total_minor, status")
        .eq("org_id", orgId)
        .eq("term_id", term.id)
        .eq("payer_guardian_id", primaryGuardian.guardian_id)
        .eq("is_credit_note", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      existingTermInvoice = invoice;
    }

    if (!existingTermInvoice) {
      const { data: invoice } = await client
        .from("invoices")
        .select("id, invoice_number, total_minor, status")
        .eq("org_id", orgId)
        .eq("term_id", term.id)
        .eq("payer_student_id", body.student_id)
        .eq("is_credit_note", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      existingTermInvoice = invoice;
    }
  }

  // 10. Get teacher and location names for display
  let teacherName: string | null = null;
  let locationName: string | null = null;
  let newTeacherName: string | null = null;
  let newLocationName: string | null = null;

  if (firstLesson.teacher_user_id) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", firstLesson.teacher_user_id)
      .single();
    teacherName = profile?.full_name || null;
  }

  if (firstLesson.location_id) {
    const { data: loc } = await client
      .from("locations")
      .select("name")
      .eq("id", firstLesson.location_id)
      .single();
    locationName = loc?.name || null;
  }

  if (body.new_teacher_id && body.new_teacher_id !== firstLesson.teacher_user_id) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", body.new_teacher_id)
      .single();
    newTeacherName = profile?.full_name || null;
  }

  if (body.new_location_id && body.new_location_id !== firstLesson.location_id) {
    const { data: loc } = await client
      .from("locations")
      .select("name")
      .eq("id", body.new_location_id)
      .single();
    newLocationName = loc?.name || null;
  }

  // 11. Insert draft term_adjustment
  const { data: draft, error: draftError } = await client
    .from("term_adjustments")
    .insert({
      org_id: orgId,
      adjustment_type: body.adjustment_type,
      student_id: body.student_id,
      term_id: term?.id || null,
      original_recurrence_id: body.recurrence_id,
      original_lessons_remaining: originalRemaining,
      original_day_of_week: originalDayOfWeek,
      original_time: originalTime + ":00",
      new_recurrence_id: null,
      new_lessons_count:
        body.adjustment_type === "day_change" ? newLessonCount : null,
      new_day_of_week: newDayName,
      new_time: newTime ? newTime + ":00" : null,
      new_teacher_id: body.new_teacher_id || null,
      new_location_id: body.new_location_id || null,
      lesson_rate_minor: lessonRate,
      lessons_difference: lessonsDifference,
      adjustment_amount_minor: adjustmentAmountMinor,
      currency_code: currencyCode,
      status: "draft",
      effective_date: effectiveDate,
      notes: body.notes || null,
      created_by: userId,
    })
    .select()
    .single();

  if (draftError) throw draftError;

  // 12. Return preview
  return jsonResponse(
    {
      adjustment_id: draft.id,
      student_name: `${student.first_name} ${student.last_name}`,
      term_name: term?.name || "Custom period",
      original_day: originalDayOfWeek,
      original_time: originalTime,
      original_remaining_lessons: originalRemaining,
      original_remaining_dates: originalDates,
      teacher_name: teacherName,
      location_name: locationName,
      new_day: newDayName,
      new_time: newTime,
      new_lesson_count: newLessonCount,
      new_lesson_dates: newLessonDates,
      new_teacher_name: newTeacherName || teacherName,
      new_location_name: newLocationName || locationName,
      lesson_rate_minor: lessonRate,
      lessons_difference: lessonsDifference,
      adjustment_amount_minor: adjustmentAmountMinor,
      vat_amount_minor: vatAmountMinor,
      total_adjustment_minor: totalAdjustmentMinor,
      currency_code: currencyCode,
      has_rate_card: body.manual_rate_minor == null,
      can_adjust_draft: existingTermInvoice?.status === "draft",
      existing_term_invoice: existingTermInvoice
        ? {
            id: existingTermInvoice.id,
            invoice_number: existingTermInvoice.invoice_number,
            total_minor: existingTermInvoice.total_minor,
            status: existingTermInvoice.status,
          }
        : null,
    },
    cors
  );
}

// ── Confirm ─────────────────────────────────────────────────────────────

async function handleConfirm(
  client: any,
  body: TermAdjustmentRequest,
  userId: string,
  cors: Record<string, string>
) {
  if (!body.adjustment_id) {
    return jsonResponse(
      { error: "adjustment_id is required for confirm" },
      cors,
      400
    );
  }

  const orgId = body.org_id;

  // 1. Fetch draft
  const { data: adjustment, error: adjError } = await client
    .from("term_adjustments")
    .select("*")
    .eq("id", body.adjustment_id)
    .eq("org_id", orgId)
    .eq("status", "draft")
    .single();

  if (adjError || !adjustment) {
    return jsonResponse(
      {
        error:
          "Adjustment not found or already confirmed. It may have been processed by another user.",
      },
      cors,
      404
    );
  }

  // 2. Cancel remaining lessons
  const { data: lessonsToCancelRaw } = await client
    .from("lessons")
    .select("id")
    .eq("recurrence_id", adjustment.original_recurrence_id)
    .eq("org_id", orgId)
    .gte("start_at", adjustment.effective_date + "T00:00:00Z")
    .eq("status", "scheduled");

  const lessonsToCancel = lessonsToCancelRaw || [];
  const cancelledIds = lessonsToCancel.map((l: any) => l.id);

  if (cancelledIds.length > 0) {
    // Cancel lessons
    await client
      .from("lessons")
      .update({
        status: "cancelled",
        cancellation_reason: "Term adjustment",
        cancelled_by: userId,
        cancelled_at: new Date().toISOString(),
      })
      .in("id", cancelledIds);

    // Delete attendance records for cancelled lessons
    await client
      .from("attendance_records")
      .delete()
      .in("lesson_id", cancelledIds);

    // Cap recurrence rule end_date
    const dayBefore = new Date(adjustment.effective_date);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    await client
      .from("recurrence_rules")
      .update({
        end_date: dayBefore.toISOString().split("T")[0],
      })
      .eq("id", adjustment.original_recurrence_id);
  }

  // 3. For day_change: create new series
  let createdIds: string[] = [];
  let newRecurrenceId: string | null = null;

  if (adjustment.adjustment_type === "day_change" && adjustment.new_day_of_week) {
    // Get original recurrence for timezone
    const { data: origRecurrence } = await client
      .from("recurrence_rules")
      .select("timezone")
      .eq("id", adjustment.original_recurrence_id)
      .single();

    const timezone = origRecurrence?.timezone || "Europe/London";
    const newDayNum = DAY_NAMES.indexOf(adjustment.new_day_of_week);

    // Get term end date
    let termEndDate = adjustment.effective_date;
    if (adjustment.term_id) {
      const { data: term } = await client
        .from("terms")
        .select("end_date")
        .eq("id", adjustment.term_id)
        .single();
      termEndDate = term?.end_date || adjustment.effective_date;
    } else {
      // No term: use 90 days from effective
      const d = new Date(adjustment.effective_date);
      d.setUTCDate(d.getUTCDate() + 90);
      termEndDate = d.toISOString().split("T")[0];
    }

    // Insert new recurrence rule
    const { data: newRecurrence, error: recError } = await client
      .from("recurrence_rules")
      .insert({
        org_id: orgId,
        pattern_type: "weekly",
        days_of_week: [newDayNum],
        interval_weeks: 1,
        start_date: adjustment.effective_date,
        end_date: termEndDate,
        timezone,
      })
      .select()
      .single();

    if (recError) throw recError;
    newRecurrenceId = newRecurrence.id;

    // Generate dates for new day
    const allNewDates = generateDatesForDay(
      adjustment.effective_date,
      termEndDate,
      newDayNum
    );

    // Filter closure dates
    const targetLocationId =
      adjustment.new_location_id || null;
    const { data: closureDates } = await client
      .from("closure_dates")
      .select("date, location_id, applies_to_all_locations")
      .eq("org_id", orgId)
      .gte("date", adjustment.effective_date)
      .lte("date", termEndDate);

    const closureDateSet = new Set<string>();
    if (closureDates) {
      for (const cd of closureDates) {
        if (
          cd.applies_to_all_locations ||
          !targetLocationId ||
          cd.location_id === targetLocationId
        ) {
          closureDateSet.add(cd.date);
        }
      }
    }

    const filteredDates = allNewDates.filter((d) => !closureDateSet.has(d));

    // Get template from one of the cancelled lessons
    const { data: templateLesson } = await client
      .from("lessons")
      .select("lesson_type, teacher_user_id, location_id, room_id, title, is_online")
      .eq("recurrence_id", adjustment.original_recurrence_id)
      .eq("org_id", orgId)
      .order("start_at", { ascending: false })
      .limit(1)
      .single();

    if (templateLesson && filteredDates.length > 0) {
      // Parse time from adjustment
      const timeParts = adjustment.new_time
        ? adjustment.new_time.split(":")
        : adjustment.original_time.split(":");
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);

      // Get duration from original lessons
      const { data: origLesson } = await client
        .from("lessons")
        .select("start_at, end_at")
        .eq("recurrence_id", adjustment.original_recurrence_id)
        .eq("org_id", orgId)
        .order("start_at", { ascending: true })
        .limit(1)
        .single();

      const origDurationMs = origLesson
        ? new Date(origLesson.end_at).getTime() -
          new Date(origLesson.start_at).getTime()
        : 30 * 60000;
      const durationMs = origDurationMs;

      const resolvedTeacher =
        adjustment.new_teacher_id || templateLesson.teacher_user_id;
      const resolvedLocation =
        adjustment.new_location_id || templateLesson.location_id;
      const resolvedRoom = adjustment.new_location_id
        ? null // Clear room if location changed
        : templateLesson.room_id;

      const lessonRows = filteredDates.map((dateStr) => {
        const startAt = new Date(dateStr + "T00:00:00Z");
        startAt.setUTCHours(hours, minutes, 0, 0);
        const endAt = new Date(startAt.getTime() + durationMs);

        return {
          org_id: orgId,
          lesson_type: templateLesson.lesson_type,
          teacher_user_id: resolvedTeacher,
          location_id: resolvedLocation,
          room_id: resolvedRoom,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          title: templateLesson.title,
          status: "scheduled" as const,
          created_by: userId,
          recurrence_id: newRecurrenceId,
          is_online: templateLesson.is_online || false,
        };
      });

      const { data: insertedLessons, error: insertError } = await client
        .from("lessons")
        .insert(lessonRows)
        .select("id");

      if (insertError) throw insertError;

      createdIds = (insertedLessons || []).map((l: any) => l.id);

      // Insert lesson_participants
      if (createdIds.length > 0) {
        const participantRows = createdIds.map((lessonId) => ({
          org_id: orgId,
          lesson_id: lessonId,
          student_id: adjustment.student_id,
        }));

        await client.from("lesson_participants").insert(participantRows);
      }
    }
  }

  // 4. Generate credit note or supplementary invoice
  let creditNoteInvoiceId: string | null = null;
  const generateInvoice = body.generate_credit_note !== false;
  const adjustmentAmount = adjustment.adjustment_amount_minor;

  if (generateInvoice && adjustmentAmount !== 0) {
    // Get org VAT settings
    const { data: org } = await client
      .from("organisations")
      .select("vat_enabled, vat_rate, currency_code")
      .eq("id", orgId)
      .single();

    const vatEnabled = org?.vat_enabled || false;
    const vatRate = org?.vat_rate || 0;
    const currencyCode = org?.currency_code || "GBP";

    const isCreditNote = adjustmentAmount > 0;
    const absAmount = Math.abs(adjustmentAmount);
    const vatAmount = vatEnabled
      ? Math.round(absAmount * vatRate / 100)
      : 0;
    const totalAmount = absAmount + vatAmount;

    // Find payer
    const { data: guardianLinks } = await client
      .from("student_guardians")
      .select("guardian_id, is_primary_payer")
      .eq("student_id", adjustment.student_id);

    const primaryGuardian = guardianLinks?.find(
      (sg: any) => sg.is_primary_payer
    );

    // Find related invoice
    let relatedInvoiceId: string | null = null;
    if (adjustment.term_id) {
      const payerFilter = primaryGuardian
        ? { payer_guardian_id: primaryGuardian.guardian_id }
        : { payer_student_id: adjustment.student_id };

      const { data: relatedInv } = await client
        .from("invoices")
        .select("id")
        .eq("org_id", orgId)
        .eq("term_id", adjustment.term_id)
        .eq("is_credit_note", false)
        .match(payerFilter)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      relatedInvoiceId = relatedInv?.id || null;
    }

    // Insert invoice
    const invoiceData: any = {
      org_id: orgId,
      status: "draft",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date().toISOString().split("T")[0],
      currency_code: currencyCode,
      subtotal_minor: isCreditNote ? -absAmount : absAmount,
      tax_minor: isCreditNote ? -vatAmount : vatAmount,
      total_minor: isCreditNote ? -totalAmount : totalAmount,
      vat_rate: vatEnabled ? vatRate : 0,
      is_credit_note: isCreditNote,
      adjustment_id: adjustment.id,
      related_invoice_id: relatedInvoiceId,
      term_id: adjustment.term_id,
      notes: isCreditNote
        ? `Credit note for term adjustment – ${adjustment.adjustment_type === "withdrawal" ? "withdrawal" : "day/time change"}`
        : `Supplementary invoice for term adjustment – day/time change`,
    };

    if (primaryGuardian) {
      invoiceData.payer_guardian_id = primaryGuardian.guardian_id;
    } else {
      invoiceData.payer_student_id = adjustment.student_id;
    }

    const { data: invoice, error: invError } = await client
      .from("invoices")
      .insert(invoiceData)
      .select("id, invoice_number")
      .single();

    if (invError) throw invError;
    creditNoteInvoiceId = invoice.id;

    // Get student name for description
    const { data: student } = await client
      .from("students")
      .select("first_name, last_name")
      .eq("id", adjustment.student_id)
      .single();

    const studentName = student
      ? `${student.first_name} ${student.last_name}`
      : "Student";
    const rateFormatted = (adjustment.lesson_rate_minor / 100).toFixed(2);

    // Insert invoice item(s)
    const itemDescription = isCreditNote
      ? adjustment.adjustment_type === "withdrawal"
        ? `Term adjustment credit – ${studentName} withdrawal – ${adjustment.lessons_difference} lesson${adjustment.lessons_difference !== 1 ? "s" : ""} × £${rateFormatted}`
        : `Term adjustment credit – ${studentName} day change – ${adjustment.lessons_difference} lesson${adjustment.lessons_difference !== 1 ? "s" : ""} difference × £${rateFormatted}`
      : `Supplementary charge – ${studentName} day change – ${Math.abs(adjustment.lessons_difference)} additional lesson${Math.abs(adjustment.lessons_difference) !== 1 ? "s" : ""} × £${rateFormatted}`;

    await client.from("invoice_items").insert({
      invoice_id: invoice.id,
      org_id: orgId,
      description: itemDescription,
      quantity: Math.abs(adjustment.lessons_difference),
      unit_price_minor: isCreditNote
        ? -adjustment.lesson_rate_minor
        : adjustment.lesson_rate_minor,
      amount_minor: isCreditNote ? -absAmount : absAmount,
      student_id: adjustment.student_id,
    });
  }

  // 5. Update term_adjustment status
  const updateData: any = {
    status: "confirmed",
    confirmed_by: userId,
    confirmed_at: new Date().toISOString(),
    cancelled_lesson_ids: cancelledIds,
    created_lesson_ids: createdIds,
  };
  if (newRecurrenceId) {
    updateData.new_recurrence_id = newRecurrenceId;
  }
  if (creditNoteInvoiceId) {
    updateData.credit_note_invoice_id = creditNoteInvoiceId;
  }

  await client
    .from("term_adjustments")
    .update(updateData)
    .eq("id", adjustment.id);

  // 6. Audit log
  await client.from("audit_log").insert({
    org_id: orgId,
    actor_user_id: userId,
    action: "confirm_term_adjustment",
    entity_type: "term_adjustment",
    entity_id: adjustment.id,
    after: {
      adjustment_type: adjustment.adjustment_type,
      student_id: adjustment.student_id,
      cancelled_count: cancelledIds.length,
      created_count: createdIds.length,
      credit_note_invoice_id: creditNoteInvoiceId,
    },
  });

  // 7. Return confirmation
  return jsonResponse(
    {
      success: true,
      adjustment_id: adjustment.id,
      cancelled_count: cancelledIds.length,
      created_count: createdIds.length,
      credit_note_invoice_id: creditNoteInvoiceId,
    },
    cors
  );
}
