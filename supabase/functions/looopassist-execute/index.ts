// Note: Function name has legacy typo "looopassist" — keep for backward compatibility
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface ActionProposal {
  id: string;
  org_id: string;
  user_id: string;
  conversation_id: string | null;
  proposal: {
    action_type: string;
    description: string;
    entities: Array<{ type: string; id: string; label: string }>;
    params: Record<string, unknown>;
  };
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { proposalId, action } = await req.json();

    if (action === "confirm") {
      // Get the proposal
      const { data: proposal, error: fetchError } = await supabase
        .from("ai_action_proposals")
        .select("*")
        .eq("id", proposalId)
        .eq("user_id", user.id)
        .single();

      if (fetchError || !proposal) {
        return new Response(JSON.stringify({ error: "Proposal not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (proposal.status !== "proposed") {
        return new Response(JSON.stringify({ error: "Proposal already processed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Role-based authorization check
      const ACTION_ROLE_PERMISSIONS: Record<string, string[]> = {
        generate_billing_run: ['owner', 'admin', 'finance'],
        send_invoice_reminders: ['owner', 'admin', 'finance'],
        reschedule_lessons: ['owner', 'admin', 'teacher'],
        draft_email: ['owner', 'admin', 'teacher'],
        mark_attendance: ['owner', 'admin', 'teacher'],
        cancel_lesson: ['owner', 'admin'],
        complete_lessons: ['owner', 'admin', 'teacher'],
        send_progress_report: ['owner', 'admin', 'teacher'],
      };

      const { data: membership, error: membershipError } = await supabase
        .from("org_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("org_id", proposal.org_id)
        .eq("status", "active")
        .single();

      if (membershipError || !membership) {
        return new Response(JSON.stringify({ error: "You are not an active member of this organisation" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const typedProposalCheck = proposal as ActionProposal;
      const actionType = typedProposalCheck.proposal.action_type;
      const allowedRoles = ACTION_ROLE_PERMISSIONS[actionType] || ['owner', 'admin'];

      if (!allowedRoles.includes(membership.role)) {
        return new Response(JSON.stringify({ error: "Your role does not have permission to execute this action" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute based on proposal type
      let result: Record<string, unknown> = {};
      let newStatus = "executed";

      try {
        const typedProposal = proposal as ActionProposal;
        const { action_type, params, entities } = typedProposal.proposal;
        const orgId = typedProposal.org_id;

        // Validate entity count cap
        if (entities && entities.length > 50) {
          throw new Error("Too many entities in proposal (max 50)");
        }

        // Validate entity ID formats (must be valid UUIDs)
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (entities) {
          for (const entity of entities) {
            if (entity.id && !UUID_RE.test(entity.id)) {
              throw new Error(`Invalid entity ID format: ${entity.id}`);
            }
          }
        }

        switch (action_type) {
          case "generate_billing_run": {
            result = await executeGenerateBillingRun(supabase, orgId, user.id, params);
            break;
          }

          case "send_invoice_reminders": {
            result = await executeSendInvoiceReminders(supabase, orgId, user.id, params);
            break;
          }

          case "reschedule_lessons": {
            result = await executeRescheduleLessons(supabase, orgId, user.id, params);
            break;
          }

          case "draft_email": {
            result = await executeDraftEmail(supabase, orgId, user.id, params);
            break;
          }

          case "mark_attendance": {
            result = await executeMarkAttendance(supabase, orgId, user.id, params);
            break;
          }

          case "cancel_lesson": {
            result = await executeCancelLesson(supabase, orgId, user.id, params);
            break;
          }

          case "complete_lessons": {
            result = await executeCompleteLessons(supabase, orgId, user.id, params);
            break;
          }

          case "send_progress_report": {
            result = await executeSendProgressReport(supabase, orgId, user.id, params);
            break;
          }

          default:
            result = { message: `Action type '${action_type}' acknowledged but not implemented` };
        }
      } catch (execError) {
        console.error("Execution error:", execError);
        newStatus = "failed";
        result = { error: execError instanceof Error ? execError.message : "Execution failed" };
      }

      // Append messaging note for actions that involve messages
      const MESSAGING_ACTIONS = ["send_invoice_reminders", "draft_email", "send_progress_report"];
      const typedForNote = proposal as ActionProposal;
      if (newStatus === "executed" && MESSAGING_ACTIONS.includes(typedForNote.proposal.action_type)) {
        const msg = result.message as string || "";
        result.message = `${msg}\n\nNote: Messages are queued for your review in the Messages page. They are not sent automatically.`;
      }

      // Build structured result block for the chat
      let resultBlock = '';
      const typedForBlock = proposal as ActionProposal;
      if (newStatus === "executed" && result.entities && Array.isArray(result.entities)) {
        resultBlock = '\n\n```result\n' + JSON.stringify({
          action_type: typedForBlock.proposal.action_type,
          status: 'success',
          summary: result.message,
          entities: result.entities,
        }) + '\n```';
      }

      const resultMessage = newStatus === "executed"
        ? `✓ ${result.message}${resultBlock}`
        : `✗ ${result.message || result.error}`;

      // Write result as assistant message in the conversation
      if (typedForBlock.conversation_id) {
        await supabase.from("ai_messages").insert({
          conversation_id: typedForBlock.conversation_id,
          org_id: typedForBlock.org_id,
          user_id: typedForBlock.user_id,
          role: "assistant",
          content: resultMessage,
        });
      }

      // Update proposal status
      await supabase
        .from("ai_action_proposals")
        .update({
          status: newStatus,
          result,
          executed_at: new Date().toISOString(),
        })
        .eq("id", proposalId);

      return new Response(JSON.stringify({ success: newStatus === "executed", result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "cancel") {
      await supabase
        .from("ai_action_proposals")
        .update({ status: "cancelled" })
        .eq("id", proposalId)
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, message: "Proposal cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Execute error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Tool 1: Generate Billing Run
async function executeGenerateBillingRun(
  supabase: any,
  orgId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const startDate = params.start_date as string;
  const endDate = params.end_date as string;
  const mode = (params.mode as string) || "monthly";

  if (!startDate || !endDate) {
    throw new Error("start_date and end_date are required");
  }

  // Fetch ALL rate cards for the org (not just the default)
  const { data: rateCards, error: rateCardsError } = await supabase
    .from("rate_cards")
    .select("id, rate_amount, duration_mins, is_default")
    .eq("org_id", orgId);

  if (rateCardsError) throw rateCardsError;

  if (!rateCards || rateCards.length === 0) {
    throw new Error(
      "No rate cards configured for this organisation. Please add rate cards in Settings → Rate Cards before running billing."
    );
  }

  // Build lookup structures
  const rateByDuration = new Map<number, number>();
  let defaultRate: number | null = null;

  for (const rc of rateCards) {
    const amount = Math.round(Number(rc.rate_amount));
    rateByDuration.set(rc.duration_mins, amount);
    if (rc.is_default) {
      defaultRate = amount;
    }
  }

  // If no card is explicitly marked as default, use the first one
  if (defaultRate === null) {
    defaultRate = Math.round(Number(rateCards[0].rate_amount));
  }

  // Build a map of rate_card id → amount for student-specific lookups
  const rateById = new Map<string, number>();
  for (const rc of rateCards) {
    rateById.set(rc.id, Math.round(Number(rc.rate_amount)));
  }

  // Fetch lessons with participants and student details
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select(`
      id, title, start_at, end_at, teacher_id, teacher_user_id,
      teacher:teachers!lessons_teacher_id_fkey(id, display_name),
      lesson_participants(student_id, students(id, first_name, last_name, default_rate_card_id, student_guardians(guardian_id, is_primary_payer)))
    `)
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("start_at", `${startDate}T00:00:00`)
    .lte("start_at", `${endDate}T23:59:59`);

  if (lessonsError) throw lessonsError;

  // ── Duplicate protection: skip already-invoiced lessons ──
  const lessonIds = (lessons || []).map((l: any) => l.id);
  let alreadyInvoicedIds = new Set<string>();

  if (lessonIds.length > 0) {
    // Query in batches of 100 to avoid query-string limits
    for (let i = 0; i < lessonIds.length; i += 100) {
      const batch = lessonIds.slice(i, i + 100);
      const { data: existingItems } = await supabase
        .from("invoice_items")
        .select("linked_lesson_id")
        .in("linked_lesson_id", batch);
      for (const item of existingItems || []) {
        if (item.linked_lesson_id) alreadyInvoicedIds.add(item.linked_lesson_id);
      }
    }
  }

  const uninvoicedLessons = (lessons || []).filter((l: any) => !alreadyInvoicedIds.has(l.id));
  const skippedCount = (lessons?.length || 0) - uninvoicedLessons.length;

  const { data: org } = await supabase
    .from("organisations")
    .select("vat_enabled, vat_rate, currency_code")
    .eq("id", orgId)
    .single();

  /**
   * Resolve the rate for a lesson + student combination.
   * Priority:
   *   1. Student's default_rate_card_id (if set and still exists)
   *   2. Rate card matching lesson duration
   *   3. Org default rate card
   */
  function resolveRate(lesson: any, student: any): number {
    // 1. Student-specific rate card
    if (student?.default_rate_card_id) {
      const studentRate = rateById.get(student.default_rate_card_id);
      if (studentRate !== undefined) return studentRate;
    }

    // 2. Match by lesson duration
    const startMs = new Date(lesson.start_at).getTime();
    const endMs = new Date(lesson.end_at).getTime();
    const durationMins = Math.round((endMs - startMs) / 60000);
    const durationRate = rateByDuration.get(durationMins);
    if (durationRate !== undefined) return durationRate;

    // 3. Fall back to default rate card
    return defaultRate!;
  }

  // Group lessons by payer
  const payerMap = new Map<string, { type: 'guardian' | 'student'; id: string; name: string; lessons: { lesson: any; student: any; rate: number }[] }>();

  for (const lesson of uninvoicedLessons) {
    for (const participant of lesson.lesson_participants || []) {
      const student = participant.students;
      if (!student) continue;

      const rate = resolveRate(lesson, student);
      const primaryGuardian = student.student_guardians?.find((sg: any) => sg.is_primary_payer);

      let payerKey: string;
      let payerInfo: { type: 'guardian' | 'student'; id: string; name: string };

      if (primaryGuardian) {
        payerKey = `guardian:${primaryGuardian.guardian_id}`;
        payerInfo = { type: 'guardian', id: primaryGuardian.guardian_id, name: 'Guardian' };
      } else {
        payerKey = `student:${student.id}`;
        payerInfo = { type: 'student', id: student.id, name: `${student.first_name} ${student.last_name}` };
      }

      if (!payerMap.has(payerKey)) {
        payerMap.set(payerKey, { ...payerInfo, lessons: [] });
      }
      payerMap.get(payerKey)!.lessons.push({ lesson, student, rate });
    }
  }

  let invoicesCreated = 0;
  const invoiceNumbers: string[] = [];

  for (const [, payer] of payerMap) {
    const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number", { _org_id: orgId });

    const subtotal = payer.lessons.reduce((sum, item) => sum + item.rate, 0);
    const taxRate = org?.vat_enabled ? Number(org.vat_rate) : 0;
    const tax = Math.round(subtotal * taxRate / 100);
    const total = subtotal + tax;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        org_id: orgId,
        invoice_number: invoiceNumber,
        payer_guardian_id: payer.type === 'guardian' ? payer.id : null,
        payer_student_id: payer.type === 'student' ? payer.id : null,
        subtotal_minor: subtotal,
        tax_minor: tax,
        total_minor: total,
        vat_rate: taxRate,
        currency_code: org?.currency_code || 'GBP',
        due_date: dueDate.toISOString().split("T")[0],
        status: 'draft',
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    const items = payer.lessons.map(({ lesson, student, rate }) => ({
      org_id: orgId,
      invoice_id: invoice.id,
      description: `Lesson: ${lesson.title} on ${new Date(lesson.start_at).toLocaleDateString('en-GB')}`,
      quantity: 1,
      unit_price_minor: rate,
      amount_minor: rate,
      linked_lesson_id: lesson.id,
      student_id: student.id,
    }));

    await supabase.from("invoice_items").insert(items);

    invoicesCreated++;
    invoiceNumbers.push(invoiceNumber);
  }

  await supabase.from("billing_runs").insert({
    org_id: orgId,
    created_by: userId,
    run_type: mode,
    start_date: startDate,
    end_date: endDate,
    status: "completed",
    summary: {
      invoices_created: invoicesCreated,
      total_lessons: uninvoicedLessons.length,
      skipped_already_invoiced: skippedCount,
      invoice_numbers: invoiceNumbers,
    },
  });

  let message = `Billing run completed. Created ${invoicesCreated} draft invoices for ${uninvoicedLessons.length} lessons.`;
  if (skippedCount > 0) {
    message += ` Skipped ${skippedCount} lesson${skippedCount !== 1 ? 's' : ''} already invoiced.`;
  }

  // Build entities for structured result card
  const entities = invoiceNumbers.map((num: string) => ({
    type: 'invoice',
    id: num,
    label: num,
    detail: 'Draft created',
  }));

  return {
    message,
    invoices_created: invoicesCreated,
    invoice_numbers: invoiceNumbers,
    skipped_already_invoiced: skippedCount,
    entities,
  };
}

// Tool 2: Send Invoice Reminders
async function executeSendInvoiceReminders(
  supabase: any,
  orgId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const invoiceIds = params.invoice_ids as string[];

  if (!invoiceIds || invoiceIds.length === 0) {
    throw new Error("invoice_ids are required");
  }

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, total_minor, due_date, status,
      guardians:payer_guardian_id(id, full_name, email),
      students:payer_student_id(id, first_name, last_name, email)
    `)
    .eq("org_id", orgId)
    .in("id", invoiceIds)
    .in("status", ["sent", "overdue"]);

  if (error) throw error;

  let remindersSent = 0;
  const results: string[] = [];

  for (const invoice of invoices || []) {
    const recipientEmail = invoice.guardians?.email || invoice.students?.email;
    const recipientName = invoice.guardians?.full_name || 
      (invoice.students ? `${invoice.students.first_name} ${invoice.students.last_name}` : "Customer");

    if (!recipientEmail) {
      results.push(`${invoice.invoice_number}: No email address`);
      continue;
    }

    await supabase.from("message_log").insert({
      org_id: orgId,
      sender_user_id: userId,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      recipient_type: invoice.guardians ? "guardian" : "student",
      recipient_id: invoice.guardians?.id || invoice.students?.id,
      subject: `Payment Reminder: Invoice ${invoice.invoice_number}`,
      body: `Dear ${recipientName},\n\nThis is a friendly reminder that invoice ${invoice.invoice_number} for £${(invoice.total_minor / 100).toFixed(2)} is outstanding. The due date was ${invoice.due_date}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.`,
      message_type: "invoice_reminder",
      status: "queued",
      related_id: invoice.id,
    });

    remindersSent++;
    results.push(`${invoice.invoice_number}: Queued for ${recipientEmail}`);
  }

  // Build entities for structured result
  const entities = (invoices || [])
    .filter((inv: any) => {
      const email = inv.guardians?.email || inv.students?.email;
      return !!email;
    })
    .map((inv: any) => ({
      type: 'invoice' as const,
      id: inv.invoice_number,
      label: inv.invoice_number,
      detail: `→ ${inv.guardians?.email || inv.students?.email}`,
    }));

  return {
    message: `Queued ${remindersSent} payment reminder(s) — review and send from Messages`,
    reminders_sent: remindersSent,
    details: results,
    entities,
  };
}

// Tool 3: Reschedule Lessons
async function executeRescheduleLessons(
  supabase: any,
  orgId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const lessonIds = params.lesson_ids as string[];
  const shiftMinutes = params.shift_minutes as number | undefined;
  const newStartTime = params.new_start_time as string | undefined;

  if (!lessonIds || lessonIds.length === 0) {
    throw new Error("lesson_ids are required");
  }

  if (!shiftMinutes && !newStartTime) {
    throw new Error("Either shift_minutes or new_start_time is required");
  }

  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, title, start_at, end_at")
    .eq("org_id", orgId)
    .in("id", lessonIds)
    .eq("status", "scheduled");

  if (error) throw error;

  let lessonsUpdated = 0;
  const results: string[] = [];

  for (const lesson of lessons || []) {
    const startAt = new Date(lesson.start_at);
    const endAt = new Date(lesson.end_at);
    const duration = endAt.getTime() - startAt.getTime();

    let newStartAt: Date;
    let newEndAt: Date;

    if (shiftMinutes) {
      newStartAt = new Date(startAt.getTime() + shiftMinutes * 60 * 1000);
      newEndAt = new Date(endAt.getTime() + shiftMinutes * 60 * 1000);
    } else if (newStartTime) {
      const [hours, minutes] = newStartTime.split(":").map(Number);
      newStartAt = new Date(startAt);
      newStartAt.setHours(hours, minutes, 0, 0);
      newEndAt = new Date(newStartAt.getTime() + duration);
    } else {
      continue;
    }

    const { error: updateError } = await supabase
      .from("lessons")
      .update({
        start_at: newStartAt.toISOString(),
        end_at: newEndAt.toISOString(),
      })
      .eq("id", lesson.id);

    if (updateError) {
      results.push(`${lesson.title}: Failed - ${updateError.message}`);
    } else {
      lessonsUpdated++;
      results.push(`${lesson.title}: Moved to ${newStartAt.toLocaleString('en-GB')}`);
    }
  }

  const entities = (lessons || []).map((l: any) => ({
    type: 'lesson' as const,
    id: l.id,
    label: l.title,
    detail: 'Rescheduled',
  }));

  return {
    message: `Rescheduled ${lessonsUpdated} lesson(s)`,
    lessons_updated: lessonsUpdated,
    details: results,
    entities,
  };
}

// Tool 4: Draft Email
async function executeDraftEmail(
  supabase: any,
  orgId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const guardianId = params.guardian_id as string;
  const studentId = params.student_id as string;
  const subject = params.subject as string;
  const body = params.body as string;

  if (!guardianId || !subject || !body) {
    throw new Error("guardian_id, subject, and body are required");
  }

  const { data: guardian, error: guardianError } = await supabase
    .from("guardians")
    .select("id, full_name, email")
    .eq("id", guardianId)
    .eq("org_id", orgId)
    .single();

  if (guardianError || !guardian) {
    throw new Error("Guardian not found");
  }

  if (!guardian.email) {
    throw new Error("Guardian has no email address");
  }

  const { data: messageLog, error: msgError } = await supabase
    .from("message_log")
    .insert({
      org_id: orgId,
      sender_user_id: userId,
      recipient_email: guardian.email,
      recipient_name: guardian.full_name,
      recipient_type: "guardian",
      recipient_id: guardianId,
      subject,
      body,
      message_type: "custom",
      status: "draft",
      related_id: studentId || null,
    })
    .select()
    .single();

  if (msgError) throw msgError;

  return {
    message: `Email draft created for ${guardian.full_name} — review in Messages before sending`,
    draft_id: messageLog.id,
    recipient_email: guardian.email,
    entities: [{
      type: 'guardian' as const,
      id: guardianId,
      label: guardian.full_name,
      detail: 'Draft created',
    }],
  };
}

// Tool 5: Mark Attendance
async function executeMarkAttendance(
  supabase: any,
  orgId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const lessonId = params.lesson_id as string;
  const records = params.records as Array<{ student_id: string; status: string }>;

  if (!lessonId) {
    throw new Error("lesson_id is required");
  }

  if (!records || records.length === 0) {
    throw new Error("attendance records are required");
  }

  // Verify lesson exists and belongs to org
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id, title, status")
    .eq("id", lessonId)
    .eq("org_id", orgId)
    .single();

  if (lessonError || !lesson) {
    throw new Error("Lesson not found");
  }

  let markedCount = 0;
  const results: string[] = [];

  for (const record of records) {
    // Verify student is a participant
    const { data: participant } = await supabase
      .from("lesson_participants")
      .select("id, students(first_name, last_name)")
      .eq("lesson_id", lessonId)
      .eq("student_id", record.student_id)
      .single();

    if (!participant) {
      results.push(`Student ${record.student_id}: Not a participant`);
      continue;
    }

    // Upsert attendance record
    const { error: attendanceError } = await supabase
      .from("attendance_records")
      .upsert({
        org_id: orgId,
        lesson_id: lessonId,
        student_id: record.student_id,
        attendance_status: record.status,
        recorded_by: userId,
        recorded_at: new Date().toISOString(),
      }, {
        onConflict: "lesson_id,student_id",
      });

    if (attendanceError) {
      results.push(`${participant.students?.first_name}: Failed - ${attendanceError.message}`);
    } else {
      markedCount++;
      results.push(`${participant.students?.first_name} ${participant.students?.last_name}: ${record.status}`);
    }
  }

  // Log to audit trail
  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor_user_id: userId,
    entity_type: "lesson",
    entity_id: lessonId,
    action: "mark_attendance",
    after: { records, results },
  });

  const entities = (records || []).map((r: any) => {
    const participant = (lessons || []).length > 0 ? null : null; // already logged in results
    return {
      type: 'student' as const,
      id: r.student_id,
      label: r.student_id, // Will be resolved from results
      detail: r.status,
    };
  });

  // Enrich entity labels from results text
  const enrichedEntities = results.map((res: string, i: number) => {
    const parts = res.split(':');
    return {
      type: 'student' as const,
      id: records[i]?.student_id || '',
      label: parts[0]?.trim() || 'Student',
      detail: parts[1]?.trim() || '',
    };
  });

  return {
    message: `Marked attendance for ${markedCount} student(s)`,
    marked_count: markedCount,
    details: results,
    entities: enrichedEntities,
  };
}

// Tool 6: Cancel Lesson
async function executeCancelLesson(
  supabase: any,
  orgId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const lessonIds = params.lesson_ids as string[];
  const reason = params.reason as string || "Cancelled by LoopAssist";
  const notify = params.notify as boolean ?? false;
  const issueCredit = params.issue_credit as boolean ?? false;

  if (!lessonIds || lessonIds.length === 0) {
    throw new Error("lesson_ids are required");
  }

  // P0 Fix: Include end_at for duration-aware credit calculation
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select(`
      id, title, start_at, end_at, status,
      lesson_participants(student_id, students(id, first_name, last_name))
    `)
    .eq("org_id", orgId)
    .in("id", lessonIds)
    .eq("status", "scheduled");

  if (error) throw error;

  // Fetch all rate cards for duration-aware credit calculation
  const { data: rateCards } = await supabase
    .from("rate_cards")
    .select("id, duration_minutes, rate_amount, is_default")
    .eq("org_id", orgId)
    .order("duration_minutes", { ascending: true });

  let cancelledCount = 0;
  let creditsIssued = 0;
  const results: string[] = [];

  for (const lesson of lessons || []) {
    // Update lesson status
    const { error: updateError } = await supabase
      .from("lessons")
      .update({ status: "cancelled" })
      .eq("id", lesson.id);

    if (updateError) {
      results.push(`${lesson.title}: Failed - ${updateError.message}`);
      continue;
    }

    cancelledCount++;
    results.push(`${lesson.title}: Cancelled`);

    // Issue make-up credits if requested - now with duration-aware pricing
    if (issueCredit && lesson.lesson_participants) {
      // Calculate lesson duration in minutes
      const lessonStart = new Date(lesson.start_at);
      const lessonEnd = new Date(lesson.end_at);
      const durationMins = Math.round((lessonEnd.getTime() - lessonStart.getTime()) / 60000);

      // Find rate card matching duration, or use default
      let creditValue = 3000; // fallback
      if (rateCards && rateCards.length > 0) {
        // Find exact match or closest lower duration
        const matchingCard = rateCards.find((rc: { duration_minutes: number }) => rc.duration_minutes === durationMins) ||
          rateCards.filter((rc: { duration_minutes: number }) => rc.duration_minutes <= durationMins).pop() ||
          rateCards.find((rc: { is_default: boolean }) => rc.is_default) ||
          rateCards[0];
        
        if (matchingCard?.rate_amount) {
          creditValue = Math.round(Number(matchingCard.rate_amount) * 100);
        }
      }

      for (const participant of lesson.lesson_participants) {
        if (participant.students) {
          await supabase.from("make_up_credits").insert({
            org_id: orgId,
            student_id: participant.student_id,
            issued_for_lesson_id: lesson.id,
            credit_value_minor: creditValue,
            notes: `Issued for cancelled ${durationMins}min lesson: ${lesson.title}`,
            created_by: userId,
          });
          creditsIssued++;
        }
      }
    }

    // Log to audit trail
    await supabase.from("audit_log").insert({
      org_id: orgId,
      actor_user_id: userId,
      entity_type: "lesson",
      entity_id: lesson.id,
      action: "cancel_lesson",
      after: { reason, notify, issueCredit },
    });
  }

  let message = `Cancelled ${cancelledCount} lesson(s)`;
  if (creditsIssued > 0) {
    message += ` and issued ${creditsIssued} make-up credit(s)`;
  }

  const entities = (lessons || []).map((l: any) => ({
    type: 'lesson' as const,
    id: l.id,
    label: l.title,
    detail: 'Cancelled',
  }));

  return {
    message,
    cancelled_count: cancelledCount,
    credits_issued: creditsIssued,
    details: results,
    entities,
  };
}

// Tool 7: Complete Lessons
async function executeCompleteLessons(
  supabase: any,
  orgId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const lessonIds = params.lesson_ids as string[];

  if (!lessonIds || lessonIds.length === 0) {
    throw new Error("lesson_ids are required");
  }

  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, title, status")
    .eq("org_id", orgId)
    .in("id", lessonIds)
    .eq("status", "scheduled");

  if (error) throw error;

  let completedCount = 0;
  const results: string[] = [];

  for (const lesson of lessons || []) {
    const { error: updateError } = await supabase
      .from("lessons")
      .update({ status: "completed" })
      .eq("id", lesson.id);

    if (updateError) {
      results.push(`${lesson.title}: Failed - ${updateError.message}`);
    } else {
      completedCount++;
      results.push(`${lesson.title}: Completed`);
    }
  }

  // Log to audit trail
  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor_user_id: userId,
    entity_type: "lesson",
    entity_id: lessonIds.join(","),
    action: "complete_lessons",
    after: { lesson_ids: lessonIds, results },
  });

  const entities = (lessons || []).map((l: any) => ({
    type: 'lesson' as const,
    id: l.id,
    label: l.title,
    detail: 'Marked complete',
  }));

  return {
    message: `Marked ${completedCount} lesson(s) as completed`,
    completed_count: completedCount,
    details: results,
    entities,
  };
}

// Tool 8: Send Progress Report
async function executeSendProgressReport(
  supabase: any,
  orgId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const studentId = params.student_id as string;
  const guardianId = params.guardian_id as string;
  const period = (params.period as string) || "month";
  const sendImmediately = params.send_immediately as boolean ?? false;

  if (!studentId) {
    throw new Error("student_id is required");
  }

  // Fetch student
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("id", studentId)
    .eq("org_id", orgId)
    .single();

  if (studentError || !student) {
    throw new Error("Student not found");
  }

  // Determine date range based on period
  const today = new Date();
  let startDate: Date;
  switch (period) {
    case "week":
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "term":
      startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default: // month
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Fetch lessons for this period
  const { data: lessonParticipants } = await supabase
    .from("lesson_participants")
    .select(`
      lessons(id, title, start_at, status, notes_shared)
    `)
    .eq("student_id", studentId)
    .gte("created_at", startDate.toISOString());

  const lessons = lessonParticipants?.map((lp: any) => lp.lessons).filter(Boolean) || [];
  const completedLessons = lessons.filter((l: any) => l.status === "completed");

  // Fetch attendance
  const { data: attendance } = await supabase
    .from("attendance_records")
    .select("attendance_status")
    .eq("student_id", studentId)
    .gte("recorded_at", startDate.toISOString());

  const presentCount = (attendance || []).filter((a: any) => a.attendance_status === "present").length;
  const attendanceRate = attendance?.length ? Math.round((presentCount / attendance.length) * 100) : 0;

  // Fetch practice stats
  const { data: practiceStreak } = await supabase
    .from("practice_streaks")
    .select("current_streak, longest_streak")
    .eq("student_id", studentId)
    .single();

  const { data: practiceLogs } = await supabase
    .from("practice_logs")
    .select("duration_minutes")
    .eq("student_id", studentId)
    .gte("practice_date", startDate.toISOString().split("T")[0]);

  const totalPracticeMinutes = (practiceLogs || []).reduce((sum: number, p: any) => sum + p.duration_minutes, 0);

  // Build report content
  const periodLabel = period === "week" ? "this week" : period === "term" ? "this term" : "this month";
  const studentName = `${student.first_name} ${student.last_name}`;
  
  let reportBody = `Progress Report for ${studentName}\n\n`;
  reportBody += `Period: ${periodLabel}\n\n`;
  reportBody += `LESSONS\n`;
  reportBody += `Total lessons: ${lessons.length}\n`;
  reportBody += `Completed: ${completedLessons.length}\n`;
  reportBody += `Attendance rate: ${attendanceRate}%\n\n`;
  
  reportBody += `PRACTICE\n`;
  reportBody += `Total practice time: ${totalPracticeMinutes} minutes\n`;
  if (practiceStreak) {
    reportBody += `Current streak: ${practiceStreak.current_streak} days\n`;
    reportBody += `Longest streak: ${practiceStreak.longest_streak} days\n`;
  }
  
  if (completedLessons.length > 0) {
    reportBody += `\nRECENT LESSON NOTES\n`;
    completedLessons.slice(0, 3).forEach((l: any) => {
      if (l.notes_shared) {
        const date = new Date(l.start_at).toLocaleDateString("en-GB");
        reportBody += `${date} - ${l.title}: ${l.notes_shared}\n`;
      }
    });
  }

  // Find guardian to send to
  let targetGuardianId = guardianId;
  if (!targetGuardianId) {
    const { data: guardianLink } = await supabase
      .from("student_guardians")
      .select("guardian_id")
      .eq("student_id", studentId)
      .eq("is_primary_payer", true)
      .single();
    targetGuardianId = guardianLink?.guardian_id;
  }

  if (!targetGuardianId) {
    throw new Error("No guardian found for this student");
  }

  const { data: guardian } = await supabase
    .from("guardians")
    .select("id, full_name, email")
    .eq("id", targetGuardianId)
    .single();

  if (!guardian || !guardian.email) {
    throw new Error("Guardian has no email address");
  }

  // Create message
  const { data: messageLog, error: msgError } = await supabase
    .from("message_log")
    .insert({
      org_id: orgId,
      sender_user_id: userId,
      recipient_email: guardian.email,
      recipient_name: guardian.full_name,
      recipient_type: "guardian",
      recipient_id: guardian.id,
      subject: `Progress Report: ${studentName}`,
      body: reportBody,
      message_type: "progress_report",
      status: sendImmediately ? "queued" : "draft",
      related_id: studentId,
    })
    .select()
    .single();

  if (msgError) throw msgError;

  return {
    message: sendImmediately 
      ? `Progress report queued for ${guardian.full_name} — review in Messages before it sends`
      : `Progress report draft created for ${guardian.full_name} — review in Messages before sending`,
    draft_id: messageLog.id,
    recipient_email: guardian.email,
    summary: {
      lessons: lessons.length,
      completed: completedLessons.length,
      attendance_rate: attendanceRate,
      practice_minutes: totalPracticeMinutes,
    },
    entities: [
      {
        type: 'student' as const,
        id: studentId,
        label: studentName,
        detail: 'Report queued',
      },
      {
        type: 'guardian' as const,
        id: guardian.id,
        label: guardian.full_name,
        detail: `→ ${guardian.email}`,
      },
    ],
  };
}
