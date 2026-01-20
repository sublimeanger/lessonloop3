import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total_minor: number;
  due_date: string;
  payer_guardian_id?: string;
  payer_student_id?: string;
  guardians?: { id: string; full_name: string; email: string | null } | null;
  students?: { id: string; first_name: string; last_name: string; email: string | null } | null;
}

interface Lesson {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  teacher_user_id: string;
  profiles?: { full_name: string } | null;
  lesson_participants?: Array<{ students: { id: string; first_name: string; last_name: string } | null }>;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
}

// Build comprehensive context for Q&A
async function buildDataContext(supabase: any, orgId: string): Promise<{
  summary: string;
  entities: { invoices: Invoice[]; lessons: Lesson[]; students: Student[]; guardians: Guardian[] };
}> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekFromNowStr = weekFromNow.toISOString().split("T")[0];

  // Fetch overdue and outstanding invoices
  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, status, total_minor, due_date, payer_guardian_id, payer_student_id,
      guardians:payer_guardian_id(id, full_name, email),
      students:payer_student_id(id, first_name, last_name, email)
    `)
    .eq("org_id", orgId)
    .in("status", ["overdue", "sent"])
    .order("due_date", { ascending: true })
    .limit(20);

  // Fetch upcoming lessons (next 7 days)
  const { data: upcomingLessons } = await supabase
    .from("lessons")
    .select(`
      id, title, start_at, end_at, status, teacher_user_id,
      lesson_participants(students(id, first_name, last_name))
    `)
    .eq("org_id", orgId)
    .gte("start_at", `${todayStr}T00:00:00`)
    .lte("start_at", `${weekFromNowStr}T23:59:59`)
    .eq("status", "scheduled")
    .order("start_at", { ascending: true })
    .limit(30);

  // Fetch active students with summary info
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, email, phone, status")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("last_name", { ascending: true })
    .limit(50);

  // Fetch guardians
  const { data: guardians } = await supabase
    .from("guardians")
    .select("id, full_name, email")
    .eq("org_id", orgId)
    .order("full_name", { ascending: true })
    .limit(50);

  // Build invoice summary with citations
  let invoiceSummary = "";
  const overdueList = (overdueInvoices || []).filter((i: Invoice) => i.status === "overdue");
  const sentList = (overdueInvoices || []).filter((i: Invoice) => i.status === "sent");

  if (overdueList.length > 0) {
    const overdueTotal = overdueList.reduce((sum: number, i: Invoice) => sum + i.total_minor, 0);
    invoiceSummary += `\n\nOVERDUE INVOICES (${overdueList.length}, total £${(overdueTotal / 100).toFixed(2)}):`;
    overdueList.slice(0, 10).forEach((inv: Invoice) => {
      const payer = inv.guardians?.full_name || 
        (inv.students ? `${inv.students.first_name} ${inv.students.last_name}` : "Unknown");
      invoiceSummary += `\n- [Invoice:${inv.invoice_number}] £${(inv.total_minor / 100).toFixed(2)} due ${inv.due_date} (${payer})`;
    });
  }

  if (sentList.length > 0) {
    const sentTotal = sentList.reduce((sum: number, i: Invoice) => sum + i.total_minor, 0);
    invoiceSummary += `\n\nOUTSTANDING INVOICES (${sentList.length}, total £${(sentTotal / 100).toFixed(2)}):`;
    sentList.slice(0, 10).forEach((inv: Invoice) => {
      const payer = inv.guardians?.full_name || 
        (inv.students ? `${inv.students.first_name} ${inv.students.last_name}` : "Unknown");
      invoiceSummary += `\n- [Invoice:${inv.invoice_number}] £${(inv.total_minor / 100).toFixed(2)} due ${inv.due_date} (${payer})`;
    });
  }

  // Build lesson summary with citations
  let lessonSummary = "";
  if ((upcomingLessons || []).length > 0) {
    // Group by day
    const byDay: Record<string, Lesson[]> = {};
    upcomingLessons.forEach((lesson: Lesson) => {
      const day = lesson.start_at.split("T")[0];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(lesson);
    });

    lessonSummary += `\n\nUPCOMING LESSONS (next 7 days):`;
    Object.entries(byDay).slice(0, 7).forEach(([day, lessons]) => {
      const dayLabel = day === todayStr ? "Today" : 
        new Date(day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      lessonSummary += `\n${dayLabel} (${lessons.length} lessons):`;
      lessons.slice(0, 5).forEach((l) => {
        const time = new Date(l.start_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const studentNames = l.lesson_participants?.map(p => 
          p.students ? `${p.students.first_name} ${p.students.last_name}` : ""
        ).filter(Boolean).join(", ") || "No students";
        lessonSummary += `\n  - [Lesson:${l.id}] ${time} ${l.title} with ${studentNames}`;
      });
    });
  }

  // Build student summary
  let studentSummary = "";
  if ((students || []).length > 0) {
    studentSummary += `\n\nACTIVE STUDENTS (${students.length}):`;
    students.slice(0, 15).forEach((s: Student) => {
      studentSummary += `\n- [Student:${s.id}] ${s.first_name} ${s.last_name}`;
    });
    if (students.length > 15) {
      studentSummary += `\n... and ${students.length - 15} more`;
    }
  }

  // Build guardian summary
  let guardianSummary = "";
  if ((guardians || []).length > 0) {
    guardianSummary += `\n\nGUARDIANS (${guardians.length}):`;
    guardians.slice(0, 10).forEach((g: Guardian) => {
      guardianSummary += `\n- [Guardian:${g.id}] ${g.full_name}${g.email ? ` (${g.email})` : ""}`;
    });
    if (guardians.length > 10) {
      guardianSummary += `\n... and ${guardians.length - 10} more`;
    }
  }

  return {
    summary: invoiceSummary + lessonSummary + studentSummary + guardianSummary,
    entities: {
      invoices: overdueInvoices || [],
      lessons: upcomingLessons || [],
      students: students || [],
      guardians: guardians || [],
    },
  };
}

const SYSTEM_PROMPT = `You are LoopAssist, an AI copilot for LessonLoop - a UK-centric music lesson scheduling and invoicing platform.

You help music teachers, academy owners, and administrators with:
- Answering questions about students, lessons, invoices, and schedules
- Drafting emails to parents/guardians
- Proposing actions like creating invoices, scheduling lessons, or sending reminders
- Providing insights about revenue, attendance, and business metrics

CRITICAL - ENTITY CITATIONS:
When referencing specific entities, ALWAYS use these citation formats:
- For invoices: [Invoice:LL-2026-XXXXX] - use the exact invoice number
- For students: [Student:uuid] - use the exact student ID
- For lessons: [Lesson:uuid] - use the exact lesson ID
- For guardians: [Guardian:uuid] - use the exact guardian ID

This allows users to click through to view details.

Guidelines:
- Be concise and professional
- Use UK English spelling and date formats (DD/MM/YYYY)
- Currency is GBP (£)
- When answering questions, cite specific entities using the formats above
- When proposing actions, clearly describe what will happen
- For read-only questions, provide helpful answers based on the context
- If you don't have enough information, ask clarifying questions

CRITICAL - ACTION PROPOSALS:
When the user requests an action (send reminders, generate invoices, reschedule, draft email), you MUST respond with a structured action proposal.

The user's request indicates they want to take action when they say things like:
- "Send reminders", "Remind", "Chase up"
- "Generate invoices", "Create billing run", "Bill for"
- "Reschedule", "Move lessons", "Shift"
- "Draft email", "Write to", "Send message to"

When proposing an action, respond with normal text PLUS a JSON block in this exact format:

\`\`\`action
{
  "action_type": "generate_billing_run" | "send_invoice_reminders" | "reschedule_lessons" | "draft_email",
  "description": "Human-readable description of what will happen",
  "entities": [
    {"type": "invoice", "id": "...", "label": "..."},
    {"type": "student", "id": "...", "label": "..."},
    {"type": "lesson", "id": "...", "label": "..."},
    {"type": "guardian", "id": "...", "label": "..."}
  ],
  "params": {
    // Action-specific parameters
  }
}
\`\`\`

ACTION TYPES AND PARAMS:

1. generate_billing_run - Create invoices for lessons in a date range
   params: { "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "mode": "term" | "monthly" | "custom" }
   entities: List students/guardians who will be billed

2. send_invoice_reminders - Send payment reminder emails for overdue/outstanding invoices
   params: { "invoice_ids": ["id1", "id2", ...] }
   entities: List invoices that will receive reminders

3. reschedule_lessons - Move lessons to a new time
   params: { "lesson_ids": ["id1", ...], "shift_minutes": 30 } OR { "lesson_ids": [...], "new_start_time": "HH:MM" }
   entities: List lessons that will be rescheduled

4. draft_email - Draft an email to a guardian about a student
   params: { "guardian_id": "...", "student_id": "...", "tone": "formal" | "friendly" | "concerned", "subject": "...", "body": "..." }
   entities: List the guardian and student involved

IMPORTANT: Only include the action block when the user explicitly requests an action. For questions or information requests, respond normally without an action block.`;

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

    // Get Supabase client for RLS-respecting queries
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

    const { messages, context, orgId } = await req.json();

    if (!orgId) {
      return new Response(JSON.stringify({ error: "Organisation ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to this org (RLS will enforce this, but double-check)
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Access denied to this organisation" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from the current page/entity
    let pageContextInfo = "";
    if (context) {
      if (context.type === "student" && context.id) {
        const { data: student } = await supabase
          .from("students")
          .select(`
            *, 
            student_guardians(*, guardians(*)),
            lesson_participants(lessons(id, title, start_at, status))
          `)
          .eq("id", context.id)
          .single();
        if (student) {
          const recentLessons = student.lesson_participants?.slice(0, 5) || [];
          const guardianLinks = student.student_guardians || [];
          pageContextInfo = `\n\nCURRENT PAGE - Student: [Student:${student.id}] ${student.first_name} ${student.last_name}
Status: ${student.status}
Email: ${student.email || "Not provided"}
Phone: ${student.phone || "Not provided"}
Recent lessons: ${recentLessons.length}`;
          
          // List guardians
          if (guardianLinks.length > 0) {
            pageContextInfo += "\nGuardians:";
            guardianLinks.forEach((link: any) => {
              if (link.guardians) {
                pageContextInfo += `\n  - [Guardian:${link.guardians.id}] ${link.guardians.full_name} (${link.relationship})`;
              }
            });
          }
          
          // Get student's invoices
          const { data: studentInvoices } = await supabase
            .from("invoices")
            .select("id, invoice_number, status, total_minor, due_date")
            .eq("payer_student_id", student.id)
            .order("created_at", { ascending: false })
            .limit(5);
          
          if (studentInvoices && studentInvoices.length > 0) {
            pageContextInfo += "\nRecent invoices:";
            studentInvoices.forEach((inv: any) => {
              pageContextInfo += `\n  - [Invoice:${inv.invoice_number}] ${inv.status} £${(inv.total_minor / 100).toFixed(2)}`;
            });
          }
        }
      } else if (context.type === "invoice" && context.id) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select(`
            *, 
            invoice_items(*),
            guardians:payer_guardian_id(id, full_name, email),
            students:payer_student_id(id, first_name, last_name, email)
          `)
          .eq("id", context.id)
          .single();
        if (invoice) {
          const payer = invoice.guardians?.full_name || 
            (invoice.students ? `${invoice.students.first_name} ${invoice.students.last_name}` : "Unknown");
          const payerId = invoice.payer_guardian_id || invoice.payer_student_id;
          const payerType = invoice.payer_guardian_id ? "Guardian" : "Student";
          pageContextInfo = `\n\nCURRENT PAGE - Invoice: [Invoice:${invoice.invoice_number}]
Invoice ID: ${invoice.id}
Status: ${invoice.status}
Total: £${(invoice.total_minor / 100).toFixed(2)}
Due: ${invoice.due_date}
Payer: [${payerType}:${payerId}] ${payer}
Items: ${invoice.invoice_items?.length || 0}`;
        }
      } else if (context.type === "calendar") {
        const today = new Date().toISOString().split("T")[0];
        const { data: todayLessons } = await supabase
          .from("lessons")
          .select("id, title, start_at, status")
          .gte("start_at", `${today}T00:00:00`)
          .lte("start_at", `${today}T23:59:59`)
          .eq("org_id", orgId)
          .eq("status", "scheduled");
        if (todayLessons) {
          pageContextInfo = `\n\nCURRENT PAGE - Calendar view
Today's scheduled lessons: ${todayLessons.length}`;
        }
      }
    }

    // Fetch org summary and comprehensive data
    const { data: orgData } = await supabase
      .from("organisations")
      .select("name, org_type, currency_code")
      .eq("id", orgId)
      .single();

    // Get user's role for context
    const userRole = membership.role;

    // Build comprehensive data context for Q&A
    const { summary: dataSummary } = await buildDataContext(supabase, orgId);

    const orgContext = orgData
      ? `\n\nORGANISATION: ${orgData.name} (${orgData.org_type})
Your role: ${userRole}
Currency: ${orgData.currency_code}`
      : "";

    // Combine all context
    const fullContext = SYSTEM_PROMPT + orgContext + pageContextInfo + dataSummary;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: fullContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("LoopAssist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
