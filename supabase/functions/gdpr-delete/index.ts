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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get request body
    const body = await req.json();
    const { action, entityType, entityId } = body;

    if (!action || !entityType || !entityId) {
      return new Response(JSON.stringify({ error: "Missing required fields: action, entityType, entityId" }), {
        status: 400,
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

    let result: { success: boolean; message: string };

    if (entityType === "student") {
      // Verify student belongs to this org
      const { data: student } = await supabase
        .from("students")
        .select("id, first_name, last_name, org_id")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();

      if (!student) {
        return new Response(JSON.stringify({ error: "Student not found or access denied" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const beforeState = { ...student };

      if (action === "soft_delete") {
        // Soft delete - mark as deleted but keep record
        const { error: updateError } = await supabaseAdmin
          .from("students")
          .update({
            status: "inactive",
            deleted_at: new Date().toISOString(),
          })
          .eq("id", entityId);

        if (updateError) throw updateError;

        result = { success: true, message: `Student ${student.first_name} ${student.last_name} has been deactivated.` };
      } else if (action === "anonymise") {
        // Anonymise personal data
        const { error: rpcError } = await supabaseAdmin.rpc("anonymise_student", { student_id: entityId });

        if (rpcError) throw rpcError;

        result = { success: true, message: `Student data has been anonymised. Invoice records are retained for accounting.` };
      } else {
        return new Response(JSON.stringify({ error: "Invalid action for student" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log to audit
      await supabaseAdmin.from("audit_log").insert({
        org_id: orgId,
        actor_user_id: user.id,
        action: `gdpr_${action}`,
        entity_type: "student",
        entity_id: entityId,
        before: beforeState,
        after: { action, result: result.message },
      });

    } else if (entityType === "guardian") {
      // Verify guardian belongs to this org
      const { data: guardian } = await supabase
        .from("guardians")
        .select("id, full_name, org_id")
        .eq("id", entityId)
        .eq("org_id", orgId)
        .single();

      if (!guardian) {
        return new Response(JSON.stringify({ error: "Guardian not found or access denied" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const beforeState = { ...guardian };

      if (action === "soft_delete") {
        // Soft delete
        const { error: updateError } = await supabaseAdmin
          .from("guardians")
          .update({
            deleted_at: new Date().toISOString(),
          })
          .eq("id", entityId);

        if (updateError) throw updateError;

        result = { success: true, message: `Guardian ${guardian.full_name} has been deactivated.` };
      } else if (action === "anonymise") {
        // Anonymise personal data
        const { error: rpcError } = await supabaseAdmin.rpc("anonymise_guardian", { guardian_id: entityId });

        if (rpcError) throw rpcError;

        result = { success: true, message: `Guardian data has been anonymised. Invoice records are retained for accounting.` };
      } else {
        return new Response(JSON.stringify({ error: "Invalid action for guardian" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log to audit
      await supabaseAdmin.from("audit_log").insert({
        org_id: orgId,
        actor_user_id: user.id,
        action: `gdpr_${action}`,
        entity_type: "guardian",
        entity_id: entityId,
        before: beforeState,
        after: { action, result: result.message },
      });

    } else {
      return new Response(JSON.stringify({ error: "Invalid entity type. Must be 'student' or 'guardian'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GDPR Delete error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
