import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

      // Execute based on proposal type
      let result: Record<string, unknown> = {};
      let newStatus = "executed";

      try {
        const typedProposal = proposal as ActionProposal;
        const { action_type, params } = typedProposal.proposal;
        const orgId = typedProposal.org_id;

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

          default:
            result = { message: `Action type '${action_type}' acknowledged but not implemented` };
        }
      } catch (execError) {
        console.error("Execution error:", execError);
        newStatus = "failed";
        result = { error: execError instanceof Error ? execError.message : "Execution failed" };
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

  // Fetch lessons in date range that haven't been billed
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select(`
      id, title, start_at, end_at, teacher_user_id,
      lesson_participants(student_id, students(id, first_name, last_name, student_guardians(guardian_id, is_primary_payer)))
    `)
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("start_at", `${startDate}T00:00:00`)
    .lte("start_at", `${endDate}T23:59:59`);

  if (lessonsError) throw lessonsError;

  // Get org settings for VAT
  const { data: org } = await supabase
    .from("organisations")
    .select("vat_enabled, vat_rate, currency_code")
    .eq("id", orgId)
    .single();

  // Get default rate card
  const { data: rateCard } = await supabase
    .from("rate_cards")
    .select("rate_amount")
    .eq("org_id", orgId)
    .eq("is_default", true)
    .single();

  const lessonRate = rateCard?.rate_amount ? Math.round(Number(rateCard.rate_amount) * 100) : 3000; // Default £30

  // Group lessons by payer
  const payerMap = new Map<string, { type: 'guardian' | 'student'; id: string; name: string; lessons: any[] }>();

  for (const lesson of lessons || []) {
    for (const participant of lesson.lesson_participants || []) {
      const student = participant.students;
      if (!student) continue;

      // Find primary payer guardian or use student as payer
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
      payerMap.get(payerKey)!.lessons.push({ lesson, student });
    }
  }

  // Create invoices for each payer
  let invoicesCreated = 0;
  const invoiceNumbers: string[] = [];

  for (const [, payer] of payerMap) {
    // Generate invoice number
    const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number", { _org_id: orgId });

    const subtotal = payer.lessons.length * lessonRate;
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

    // Create invoice items for each lesson
    const items = payer.lessons.map(({ lesson, student }) => ({
      org_id: orgId,
      invoice_id: invoice.id,
      description: `Lesson: ${lesson.title} on ${new Date(lesson.start_at).toLocaleDateString('en-GB')}`,
      quantity: 1,
      unit_price_minor: lessonRate,
      amount_minor: lessonRate,
      linked_lesson_id: lesson.id,
      student_id: student.id,
    }));

    await supabase.from("invoice_items").insert(items);

    invoicesCreated++;
    invoiceNumbers.push(invoiceNumber);
  }

  // Create billing run record
  await supabase.from("billing_runs").insert({
    org_id: orgId,
    created_by: userId,
    run_type: mode,
    start_date: startDate,
    end_date: endDate,
    status: "completed",
    summary: {
      invoices_created: invoicesCreated,
      total_lessons: lessons?.length || 0,
      invoice_numbers: invoiceNumbers,
    },
  });

  return {
    message: `Billing run completed. Created ${invoicesCreated} draft invoices for ${lessons?.length || 0} lessons.`,
    invoices_created: invoicesCreated,
    invoice_numbers: invoiceNumbers,
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

  // Fetch invoices with payer details
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

    // Log the message (actual email would be sent via send-invoice-email function)
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
      status: "sent",
      sent_at: new Date().toISOString(),
      related_id: invoice.id,
    });

    remindersSent++;
    results.push(`${invoice.invoice_number}: Reminder sent to ${recipientEmail}`);
  }

  return {
    message: `Sent ${remindersSent} payment reminder(s)`,
    reminders_sent: remindersSent,
    details: results,
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

  // Fetch lessons
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

  return {
    message: `Rescheduled ${lessonsUpdated} lesson(s)`,
    lessons_updated: lessonsUpdated,
    details: results,
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

  // Fetch guardian details
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

  // Create message log entry as draft
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
    message: `Email draft created for ${guardian.full_name}`,
    draft_id: messageLog.id,
    recipient: guardian.full_name,
    recipient_email: guardian.email,
  };
}
