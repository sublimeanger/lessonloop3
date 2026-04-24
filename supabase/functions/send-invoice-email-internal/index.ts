// Service-role counterpart to send-invoice-email. Same core send
// logic via _shared/send-invoice-email-core.ts (C2); two distinct
// auth surfaces.
//
// Auth: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>, exact match.
// No user lookup, no rate limit.
//
// Defence-in-depth: invoices must have generated_from_template_id set
// (i.e. originated from a recurring template). See C3 rationale in the
// design doc Appendix A.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import {
  sendInvoiceEmailCore,
  type InvoiceRow,
  type SendInvoiceCoreInput,
  type SendInvoiceSource,
} from "../_shared/send-invoice-email-core.ts";

interface InternalRequestBody {
  invoice_id: string;
  source: Extract<SendInvoiceSource, "recurring_scheduler" | "recurring_manual_run">;
  is_reminder?: boolean;
}

const ALLOWED_SOURCES: SendInvoiceSource[] = [
  "recurring_scheduler",
  "recurring_manual_run",
];

const handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Service-role auth: exact-match the service-role bearer token.
    const authHeader = req.headers.get("Authorization");
    const expected = `Bearer ${serviceKey}`;
    if (!authHeader || authHeader !== expected) {
      return new Response(
        JSON.stringify({ error: "Service-role authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: InternalRequestBody = await req.json();
    const { invoice_id, source, is_reminder = false } = body ?? {};

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!source || !ALLOWED_SOURCES.includes(source)) {
      return new Response(
        JSON.stringify({
          error: `source must be one of: ${ALLOWED_SOURCES.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseService = createClient(supabaseUrl, serviceKey);

    // Defence-in-depth: reject invoices not generated from a recurring
    // template. Prevents accidental misuse if a future caller points
    // this endpoint at a manual invoice — that would log a message_log
    // row with sender_user_id=NULL that looks like a real send but
    // isn't traceable to a user.
    const { data: invoiceGuard, error: guardErr } = await supabaseService
      .from("invoices")
      .select("id, generated_from_template_id")
      .eq("id", invoice_id)
      .maybeSingle();

    if (guardErr) {
      console.error("[send-invoice-email-internal] invoice guard fetch failed:", guardErr);
      return new Response(
        JSON.stringify({ error: "Invoice lookup failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!invoiceGuard) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!invoiceGuard.generated_from_template_id) {
      return new Response(
        JSON.stringify({
          error:
            "send-invoice-email-internal accepts only invoices generated from recurring templates (generated_from_template_id IS NOT NULL).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Trust is established by service-role auth + the guard above.
    const authorize = async (_invoice: InvoiceRow): Promise<boolean> => true;

    const input: SendInvoiceCoreInput = {
      supabaseService,
      corsHeaders,
      invoiceId: invoice_id,
      isReminder: is_reminder,
      customMessage: undefined,
      preview: false,
      senderUserId: null,
      source,
      skipDebounce: false,
      authorize,
    };

    const { response } = await sendInvoiceEmailCore(input);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-invoice-email-internal] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
