import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's current org
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.current_org_id) {
      return new Response(JSON.stringify({ error: "No organisation selected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = profile.current_org_id;

    // Check if user is admin/owner
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Permission denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all data for the org
    const [studentsResult, guardiansResult, lessonsResult, invoicesResult, paymentsResult, orgResult] = await Promise.all([
      supabase.from("students").select("*").eq("org_id", orgId),
      supabase.from("guardians").select("*").eq("org_id", orgId),
      supabase.from("lessons").select("*").eq("org_id", orgId),
      supabase.from("invoices").select("*").eq("org_id", orgId),
      supabase.from("payments").select("*").eq("org_id", orgId),
      supabase.from("organisations").select("name").eq("id", orgId).single(),
    ]);

    const students = studentsResult.data || [];
    const guardians = guardiansResult.data || [];
    const lessons = lessonsResult.data || [];
    const invoices = invoicesResult.data || [];
    const payments = paymentsResult.data || [];
    const orgName = orgResult.data?.name || "organisation";

    // Helper to convert array to CSV
    function toCSV(data: Record<string, unknown>[], columns: string[]): string {
      if (data.length === 0) return columns.join(",") + "\n";
      
      const header = columns.join(",");
      const rows = data.map((row) =>
        columns
          .map((col) => {
            const value = row[col];
            if (value === null || value === undefined) return "";
            const str = String(value);
            // Escape quotes and wrap in quotes if contains comma or newline
            if (str.includes(",") || str.includes("\n") || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      );
      return [header, ...rows].join("\n");
    }

    // Define columns for each entity
    const studentColumns = ["id", "first_name", "last_name", "email", "phone", "dob", "notes", "status", "created_at", "updated_at", "deleted_at"];
    const guardianColumns = ["id", "full_name", "email", "phone", "user_id", "created_at", "updated_at", "deleted_at"];
    const lessonColumns = ["id", "title", "teacher_user_id", "start_at", "end_at", "status", "lesson_type", "location_id", "room_id", "notes_shared", "created_at", "updated_at"];
    const invoiceColumns = ["id", "invoice_number", "payer_guardian_id", "payer_student_id", "status", "subtotal_minor", "tax_minor", "total_minor", "currency_code", "issue_date", "due_date", "created_at", "updated_at"];
    const paymentColumns = ["id", "invoice_id", "amount_minor", "currency_code", "method", "provider", "paid_at", "created_at"];

    const studentsCSV = toCSV(students, studentColumns);
    const guardiansCSV = toCSV(guardians, guardianColumns);
    const lessonsCSV = toCSV(lessons, lessonColumns);
    const invoicesCSV = toCSV(invoices, invoiceColumns);
    const paymentsCSV = toCSV(payments, paymentColumns);

    // Return as JSON with CSV content for each entity
    const exportData = {
      organisation: orgName,
      exportedAt: new Date().toISOString(),
      files: {
        students: studentsCSV,
        guardians: guardiansCSV,
        lessons: lessonsCSV,
        invoices: invoicesCSV,
        payments: paymentsCSV,
      },
      counts: {
        students: students.length,
        guardians: guardians.length,
        lessons: lessons.length,
        invoices: invoices.length,
        payments: payments.length,
      },
    };

    // Log to audit
    await supabase.from("audit_log").insert({
      org_id: orgId,
      actor_user_id: user.id,
      action: "gdpr_export",
      entity_type: "organisation",
      entity_id: orgId,
      after: { counts: exportData.counts },
    });

    return new Response(JSON.stringify(exportData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GDPR Export error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
