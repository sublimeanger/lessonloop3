import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import {
  sendInvoiceEmailCore,
  type InvoiceRow,
  type SendInvoiceCoreInput,
} from "../_shared/send-invoice-email-core.ts";
import { wrapEdgeFn } from "../_shared/sentry.ts";

interface InvoiceEmailRequest {
  invoiceId: string;
  isReminder: boolean;
  customMessage?: string;
  preview?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Pass token explicitly — getUser() no-args makes a /auth/v1/user request
    // which on this project rejects legacy HS256 JWTs (sessions 10/11 finding;
    // see audit/findings/2026-05-09-edge-fn-env-injection-mismatch.md).
    // getUser(token) does local JWKS verification which accepts the legacy
    // format. Same pattern as send-message:57 + send-bulk-message (08e66e6).
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: InvoiceEmailRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { invoiceId, isReminder, customMessage, preview } = body;

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // J3-F3: Split rate limits — reminders have their own bucket so a
    // teacher sending initial invoices doesn't throttle overdue chases.
    // J3-F8: Preview mode bypasses rate limits entirely (read-only operation).
    if (!preview) {
      const rateLimitKey = isReminder ? "send-invoice-reminder" : "send-invoice-email";
      const rateLimitResult = await checkRateLimit(user.id, rateLimitKey);
      if (!rateLimitResult.allowed) {
        return rateLimitResponse(corsHeaders, rateLimitResult);
      }
    }

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // INV-H1: authorize callback runs the org_memberships gate against
    // the fetched invoice. Core invokes this after invoice fetch and
    // before render/log.
    const authorize = async (invoice: InvoiceRow): Promise<boolean> => {
      const { data: membership } = await supabaseService
        .from("org_memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("org_id", invoice.org_id)
        .eq("status", "active")
        .in("role", ["owner", "admin", "finance"])
        .maybeSingle();
      return !!membership;
    };

    const input: SendInvoiceCoreInput = {
      supabaseService,
      corsHeaders,
      invoiceId,
      isReminder,
      customMessage,
      preview,
      senderUserId: user.id,
      source: "user_manual",
      skipDebounce: false,
      authorize,
    };

    const { response } = await sendInvoiceEmailCore(input);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-invoice-email] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(wrapEdgeFn("send-invoice-email", handler));
