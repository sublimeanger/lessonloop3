import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const SYSTEM_PROMPT = `You are LoopAssist, the helpful assistant in the LessonLoop parent portal. You help parents stay informed about their children's music education.

You're warm, encouraging, and focused on helping parents understand their child's progress. You celebrate achievements ("Great news — Sophie has a 14-day practice streak!") and keep things simple.

You can help with:
- Viewing upcoming lesson schedules
- Checking attendance history
- Understanding practice progress
- Viewing and understanding invoices
- Answering questions about their child's music education journey

You CANNOT:
- Modify any data (lessons, attendance, invoices)
- See other families' information
- Access teacher-only or admin-only notes
- Reschedule lessons (suggest they contact the academy)
- Process payments (direct them to the invoice payment link)

Always use UK English. Be concise and positive. Format currency in GBP (£). Use DD/MM/YYYY date format.
When listing information, use clear formatting with bullet points or short tables.
Never expose internal IDs, system details, or data from other families.`;

serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorised" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 10 messages per hour for parents
    const rateCheck = await checkRateLimit(user.id, "parent-loopassist-chat", {
      maxRequests: 10,
      windowMinutes: 60,
    });
    if (!rateCheck.allowed) {
      return rateLimitResponse(corsHeaders, rateCheck);
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the parent's guardian record(s) and linked children
    const { data: guardians } = await supabase
      .from("guardians")
      .select("id, full_name, org_id")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (!guardians || guardians.length === 0) {
      return new Response(JSON.stringify({ error: "No parent profile found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = guardians[0].org_id;
    const guardianIds = guardians.map((g) => g.id);

    // Fetch org name for context
    const { data: orgData } = await supabase
      .from("organisations")
      .select("name, currency_code")
      .eq("id", orgId)
      .single();

    // Get linked student IDs
    const { data: studentLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .in("guardian_id", guardianIds);

    const studentIds = (studentLinks || []).map((sl) => sl.student_id);

    if (studentIds.length === 0) {
      return new Response(JSON.stringify({ error: "No linked children found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all scoped data in parallel
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const [
      studentsResult,
      upcomingLessonsResult,
      recentAttendanceResult,
      practiceStreaksResult,
      invoicesResult,
    ] = await Promise.all([
      // Children details
      supabase
        .from("students")
        .select("id, first_name, last_name, status")
        .in("id", studentIds),
      // Upcoming lessons (next 14 days)
      supabase
        .from("lesson_participants")
        .select(`
          student_id,
          lessons:lesson_id(id, title, start_at, end_at, status, location_id, locations:location_id(name))
        `)
        .in("student_id", studentIds)
        .eq("org_id", orgId),
      // Recent attendance (last 30 days)
      supabase
        .from("attendance_records")
        .select("student_id, attendance_status, recorded_at, lesson_id")
        .in("student_id", studentIds)
        .eq("org_id", orgId)
        .gte("recorded_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("recorded_at", { ascending: false })
        .limit(50),
      // Practice streaks
      supabase
        .from("practice_streaks")
        .select("student_id, current_streak, longest_streak, total_minutes, last_practice_date")
        .in("student_id", studentIds)
        .eq("org_id", orgId),
      // Invoices where parent is payer
      supabase
        .from("invoices")
        .select("id, invoice_number, status, total_minor, due_date, issue_date, paid_minor, currency_code")
        .eq("org_id", orgId)
        .in("payer_guardian_id", guardianIds)
        .order("issue_date", { ascending: false })
        .limit(20),
    ]);

    const students = studentsResult.data || [];
    const studentMap = new Map(students.map((s) => [s.id, `${s.first_name} ${s.last_name}`]));

    // Build context string
    let dataContext = "";

    // Children
    dataContext += "\n\nYOUR CHILDREN:\n";
    for (const s of students) {
      dataContext += `- ${s.first_name} ${s.last_name} (${s.status})\n`;
    }

    // Upcoming lessons
    const allParticipants = upcomingLessonsResult.data || [];
    const upcomingLessons = allParticipants
      .filter((p: any) => p.lessons && p.lessons.status === "scheduled" && p.lessons.start_at >= now.toISOString())
      .sort((a: any, b: any) => a.lessons.start_at.localeCompare(b.lessons.start_at))
      .slice(0, 20);

    if (upcomingLessons.length > 0) {
      dataContext += "\nUPCOMING LESSONS:\n";
      for (const lp of upcomingLessons) {
        const l = (lp as any).lessons;
        const studentName = studentMap.get(lp.student_id) || "Unknown";
        const start = new Date(l.start_at);
        const dateStr = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        const timeStr = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const location = l.locations?.name || "";
        dataContext += `- ${dateStr} ${timeStr}: ${l.title} (${studentName})${location ? ` at ${location}` : ""}\n`;
      }
    } else {
      dataContext += "\nNo upcoming lessons scheduled.\n";
    }

    // Attendance summary
    const attendance = recentAttendanceResult.data || [];
    if (attendance.length > 0) {
      const statusCounts: Record<string, number> = {};
      for (const a of attendance) {
        statusCounts[a.attendance_status] = (statusCounts[a.attendance_status] || 0) + 1;
      }
      dataContext += "\nATTENDANCE (last 30 days):\n";
      for (const [status, count] of Object.entries(statusCounts)) {
        dataContext += `- ${status}: ${count}\n`;
      }
    }

    // Practice
    const streaks = practiceStreaksResult.data || [];
    if (streaks.length > 0) {
      dataContext += "\nPRACTICE PROGRESS:\n";
      for (const s of streaks) {
        const studentName = studentMap.get(s.student_id) || "Unknown";
        dataContext += `- ${studentName}: Current streak ${s.current_streak} days, longest ${s.longest_streak} days, total ${s.total_minutes} minutes`;
        if (s.last_practice_date) {
          dataContext += `, last practised ${s.last_practice_date}`;
        }
        dataContext += "\n";
      }
    }

    // Invoices
    const invoices = invoicesResult.data || [];
    if (invoices.length > 0) {
      dataContext += "\nINVOICES:\n";
      for (const inv of invoices) {
        const total = (inv.total_minor / 100).toFixed(2);
        const paid = ((inv.paid_minor || 0) / 100).toFixed(2);
        dataContext += `- ${inv.invoice_number}: £${total} (${inv.status}) due ${inv.due_date}`;
        if (inv.status === "partially_paid") {
          dataContext += ` — £${paid} paid`;
        }
        dataContext += "\n";
      }
    }

    // Build full system prompt
    const orgContext = orgData
      ? `\n\nACADEMY: ${orgData.name}\nCurrency: ${orgData.currency_code || "GBP"}`
      : "";

    const parentContext = `\nParent: ${guardians[0].full_name}`;

    const dateTimeStr = now.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }) + ", " + now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const fullContext = SYSTEM_PROMPT + orgContext + parentContext +
      `\nCurrent date and time: ${dateTimeStr}` + dataContext;

    // Call Anthropic — always Haiku for parent queries
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const anthropicMessages = messages
      .filter((m: { role: string; content: string }) => m.role && m.content)
      .slice(-10) // Keep last 10 messages only for ephemeral sessions
      .map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: typeof m.content === "string" ? m.content : String(m.content),
      }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: fullContext,
        messages: anthropicMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 529) {
        return new Response(JSON.stringify({ error: "AI service is busy. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const textBlocks = result.content
      ?.filter((b: any) => b.type === "text")
      ?.map((b: any) => b.text)
      ?.join("") || "";

    // Stream the response using SSE format
    const sseEncoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunkSize = 20;
        for (let i = 0; i < textBlocks.length; i += chunkSize) {
          const chunk = textBlocks.slice(i, i + chunkSize);
          controller.enqueue(sseEncoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
        controller.enqueue(sseEncoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Parent LoopAssist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
