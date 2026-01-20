import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are LoopAssist, an AI copilot for LessonLoop - a UK-centric music lesson scheduling and invoicing platform.

You help music teachers, academy owners, and administrators with:
- Answering questions about students, lessons, invoices, and schedules
- Drafting emails to parents/guardians
- Proposing actions like creating invoices, scheduling lessons, or sending reminders
- Providing insights about revenue, attendance, and business metrics

Guidelines:
- Be concise and professional
- Use UK English spelling and date formats (DD/MM/YYYY)
- Currency is GBP (£)
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

    // Build context from the current page/entity
    let contextInfo = "";
    if (context) {
      if (context.type === "student" && context.id) {
        const { data: student } = await supabase
          .from("students")
          .select("*, student_guardians(*, guardians(*))")
          .eq("id", context.id)
          .single();
        if (student) {
          contextInfo = `\n\nCurrent context - Student: ${student.first_name} ${student.last_name}
Status: ${student.status}
Email: ${student.email || "Not provided"}
Phone: ${student.phone || "Not provided"}`;
        }
      } else if (context.type === "invoice" && context.id) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("*, invoice_items(*)")
          .eq("id", context.id)
          .single();
        if (invoice) {
          contextInfo = `\n\nCurrent context - Invoice: ${invoice.invoice_number}
Status: ${invoice.status}
Total: £${(invoice.total_minor / 100).toFixed(2)}
Due: ${invoice.due_date}`;
        }
      } else if (context.type === "calendar") {
        const today = new Date().toISOString().split("T")[0];
        const { data: todayLessons } = await supabase
          .from("lessons")
          .select("*")
          .gte("start_at", `${today}T00:00:00`)
          .lte("start_at", `${today}T23:59:59`)
          .eq("org_id", orgId);
        if (todayLessons) {
          contextInfo = `\n\nCurrent context - Calendar view
Today's lessons: ${todayLessons.length}`;
        }
      }
    }

    // Fetch org summary for context
    const { data: orgData } = await supabase
      .from("organisations")
      .select("name, org_type, currency_code")
      .eq("id", orgId)
      .single();

    const { count: studentCount } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active");

    const { count: pendingInvoices } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["sent", "overdue"]);

    const orgContext = orgData
      ? `\n\nOrganisation: ${orgData.name} (${orgData.org_type})
Active students: ${studentCount || 0}
Pending invoices: ${pendingInvoices || 0}`
      : "";

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
          { role: "system", content: SYSTEM_PROMPT + orgContext + contextInfo },
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
