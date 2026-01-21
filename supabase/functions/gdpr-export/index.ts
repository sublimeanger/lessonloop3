import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const [studentsResult, guardiansResult, lessonsResult, invoicesResult, paymentsResult, orgResult] = await Promise.all([
      supabase.from("students").select("*").eq("org_id", orgId),
      supabase.from("guardians").select("*").eq("org_id", orgId),
      supabase.from("lessons").select("*").eq("org_id", orgId),
      supabase.from("invoices").select("*").eq("org_id", orgId),
      supabase.from("payments").select("*").eq("org_id", orgId),
      supabase.from("organisations").select("name").eq("id", orgId).single(),
    ]);

    function toCSV(data: Record<string, unknown>[], columns: string[]): string {
      if (data.length === 0) return columns.join(",") + "\n";
      const header = columns.join(",");
      const rows = data.map((row) =>
        columns.map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return "";
          const str = String(value);
          if (str.includes(",") || str.includes("\n") || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(",")
      );
      return [header, ...rows].join("\n");
    }

    const exportData = {
      organisation: orgResult.data?.name || "organisation",
      exportedAt: new Date().toISOString(),
      files: {
        students: toCSV(studentsResult.data || [], ["id", "first_name", "last_name", "email", "phone", "dob", "notes", "status", "created_at"]),
        guardians: toCSV(guardiansResult.data || [], ["id", "full_name", "email", "phone", "created_at"]),
        lessons: toCSV(lessonsResult.data || [], ["id", "title", "start_at", "end_at", "status", "lesson_type", "created_at"]),
        invoices: toCSV(invoicesResult.data || [], ["id", "invoice_number", "status", "total_minor", "due_date", "created_at"]),
        payments: toCSV(paymentsResult.data || [], ["id", "invoice_id", "amount_minor", "method", "paid_at"]),
      },
      counts: {
        students: studentsResult.data?.length || 0,
        guardians: guardiansResult.data?.length || 0,
        lessons: lessonsResult.data?.length || 0,
        invoices: invoicesResult.data?.length || 0,
        payments: paymentsResult.data?.length || 0,
      },
    };

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
