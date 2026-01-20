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
  guardians?: { full_name: string } | null;
  students?: { first_name: string; last_name: string } | null;
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

// Build comprehensive context for Q&A
async function buildDataContext(supabase: any, orgId: string): Promise<{
  summary: string;
  entities: { invoices: Invoice[]; lessons: Lesson[]; students: Student[] };
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
      guardians:payer_guardian_id(full_name),
      students:payer_student_id(first_name, last_name)
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
        lessonSummary += `\n  - ${time} ${l.title} with ${studentNames}`;
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

  return {
    summary: invoiceSummary + lessonSummary + studentSummary,
    entities: {
      invoices: overdueInvoices || [],
      lessons: upcomingLessons || [],
      students: students || [],
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
When referencing specific invoices, students, or lessons in your answers, ALWAYS use the citation format from the data:
- For invoices: [Invoice:LL-2026-XXXXX] - use the exact invoice number
- For students: [Student:uuid] - use the exact student ID from the data

This allows users to click through to view details.

Guidelines:
- Be concise and professional
- Use UK English spelling and date formats (DD/MM/YYYY)
- Currency is GBP (£)
- When answering questions, cite specific entities using the formats above
- When proposing actions, clearly describe what will happen and ask for confirmation
- For read-only questions, provide helpful answers based on the context
- If you don't have enough information, ask clarifying questions

When proposing an action, format it as:
**Proposed Action:** [action type]
[Description of what will happen]
[Click "Confirm" below to execute this action]

Available action types:
- send_invoice_reminder: Send payment reminder email
- draft_email: Draft an email to a guardian/student
- schedule_lesson: Propose a new lesson
- run_billing: Start a billing run for a date range`;

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
          pageContextInfo = `\n\nCURRENT PAGE - Student: [Student:${student.id}] ${student.first_name} ${student.last_name}
Status: ${student.status}
Email: ${student.email || "Not provided"}
Phone: ${student.phone || "Not provided"}
Recent lessons: ${recentLessons.length}`;
          
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
            guardians:payer_guardian_id(full_name, email),
            students:payer_student_id(first_name, last_name, email)
          `)
          .eq("id", context.id)
          .single();
        if (invoice) {
          const payer = invoice.guardians?.full_name || 
            (invoice.students ? `${invoice.students.first_name} ${invoice.students.last_name}` : "Unknown");
          pageContextInfo = `\n\nCURRENT PAGE - Invoice: [Invoice:${invoice.invoice_number}]
Status: ${invoice.status}
Total: £${(invoice.total_minor / 100).toFixed(2)}
Due: ${invoice.due_date}
Payer: ${payer}
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
