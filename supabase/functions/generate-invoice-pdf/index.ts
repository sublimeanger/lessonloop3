/**
 * Journey 11 Phase 1 — generate-invoice-pdf
 *
 * Server-side renderer for invoice PDFs. Calls the shared renderer at
 * _shared/invoice-pdf.ts (mirrored to src/lib/invoice-pdf-renderer.ts
 * for the browser path) and caches the result in the invoice-pdfs
 * storage bucket at {org_id}/{invoice_id}_{pdf_rev}.pdf.
 *
 * Auth: service-role only. End-user flows route through send-invoice-email
 * or send-payment-receipt (P2/P3), which gate on the user JWT and then
 * service-call this function.
 *
 * Request:
 *   { invoice_id: string,
 *     force_regenerate?: boolean,   // skip cache check, render fresh
 *     return_bytes?: boolean }       // return inline base64 vs signed URL
 *
 * Response:
 *   { success: true,
 *     cached: boolean,
 *     filename: string,
 *     signed_url?: string,    // when return_bytes is false (default)
 *     pdf_base64?: string }   // when return_bytes is true
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { renderInvoicePdf, type InvoicePdfInput } from "../_shared/invoice-pdf.ts";

interface GenerateRequest {
  invoice_id: string;
  force_regenerate?: boolean;
  return_bytes?: boolean;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const log = (msg: string) => console.log(`[generate-invoice-pdf] ${msg}`);

// Chunked base64 encoding — apply() with very large arg lists can stack
// overflow for PDFs over ~100KB. 32KB chunks are safe in V8/Deno.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[],
    );
  }
  return btoa(binary);
}

// Supabase joined-relation columns come back either as a single object
// or as an array depending on FK shape; normalise to single-or-null.
function flat<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const expected = `Bearer ${serviceKey}`;
    if (!authHeader || authHeader !== expected) {
      return new Response(
        JSON.stringify({ error: "Service-role authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: GenerateRequest = await req.json();
    const { invoice_id, force_regenerate = false, return_bytes = false } = body ?? {};

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Fetch invoice + relations ──────────────────────────────────
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select(`
        id, org_id, invoice_number, status, issue_date, due_date,
        subtotal_minor, tax_minor, vat_rate, total_minor,
        credit_applied_minor, paid_minor, payment_plan_enabled,
        installment_count, notes, pdf_rev,
        payer_guardian:guardians!payer_guardian_id(id, full_name, email),
        payer_student:students!payer_student_id(id, first_name, last_name, email)
      `)
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      log(`Invoice not found: ${invoice_id}`);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cachePath = `${invoice.org_id}/${invoice.id}_${invoice.pdf_rev}.pdf`;
    const filename = `${invoice.invoice_number}.pdf`;

    // ── Cache hit path ─────────────────────────────────────────────
    if (!force_regenerate) {
      const { data: existing } = await supabase
        .storage
        .from("invoice-pdfs")
        .download(cachePath);

      if (existing) {
        log(`Cache hit: ${cachePath}`);
        if (return_bytes) {
          const bytes = new Uint8Array(await existing.arrayBuffer());
          return new Response(
            JSON.stringify({
              success: true,
              cached: true,
              pdf_base64: bytesToBase64(bytes),
              filename,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const { data: signed } = await supabase
          .storage
          .from("invoice-pdfs")
          .createSignedUrl(cachePath, SIGNED_URL_TTL_SECONDS);
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            signed_url: signed?.signedUrl ?? null,
            filename,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Cache miss: render fresh ───────────────────────────────────
    log(`Cache miss, rendering: ${cachePath}`);

    const [{ data: items }, { data: payments }, { data: installments }, { data: org }] =
      await Promise.all([
        supabase.from("invoice_items")
          .select("description, quantity, unit_price_minor, amount_minor")
          .eq("invoice_id", invoice_id)
          .order("created_at", { ascending: true }),
        supabase.from("payments")
          .select("amount_minor, paid_at, method")
          .eq("invoice_id", invoice_id)
          .order("paid_at", { ascending: false }),
        invoice.payment_plan_enabled
          ? supabase.from("invoice_installments")
              .select("installment_number, amount_minor, due_date, status, paid_at")
              .eq("invoice_id", invoice_id)
              .order("installment_number", { ascending: true })
          : Promise.resolve({ data: [] as unknown[] }),
        supabase.from("organisations")
          .select(`
            name, address, logo_url, brand_color, accent_color,
            invoice_from_name, invoice_from_address_line1,
            invoice_from_address_line2, invoice_from_city,
            invoice_from_postcode, invoice_from_country,
            invoice_footer_note, vat_enabled, vat_registration_number,
            bank_account_name, bank_sort_code, bank_account_number,
            bank_reference_prefix, currency_code
          `)
          .eq("id", invoice.org_id)
          .single(),
      ]);

    // Pre-load logo as data URL (Deno-safe).
    let logoDataUrl: string | null = null;
    if (org?.logo_url) {
      try {
        const logoResp = await fetch(org.logo_url);
        if (logoResp.ok) {
          const buf = await logoResp.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const b64 = bytesToBase64(bytes);
          const mime = logoResp.headers.get("content-type") ?? "image/png";
          logoDataUrl = `data:${mime};base64,${b64}`;
        }
      } catch (e) {
        log(`Logo fetch failed (non-fatal): ${e}`);
      }
    }

    const input: InvoicePdfInput = {
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        subtotal_minor: invoice.subtotal_minor,
        tax_minor: invoice.tax_minor,
        vat_rate: invoice.vat_rate,
        total_minor: invoice.total_minor,
        credit_applied_minor: invoice.credit_applied_minor,
        paid_minor: invoice.paid_minor,
        payment_plan_enabled: invoice.payment_plan_enabled,
        notes: invoice.notes,
        payer_guardian: flat(invoice.payer_guardian) as InvoicePdfInput["invoice"]["payer_guardian"],
        payer_student: flat(invoice.payer_student) as InvoicePdfInput["invoice"]["payer_student"],
        items: (items ?? []) as InvoicePdfInput["invoice"]["items"],
        payments: (payments ?? []) as InvoicePdfInput["invoice"]["payments"],
        installments: (installments ?? []) as InvoicePdfInput["invoice"]["installments"],
      },
      org: org as InvoicePdfInput["org"],
      currency: org?.currency_code ?? "GBP",
      logoDataUrl,
    };

    const pdfBytes = await renderInvoicePdf(input);

    // ── Upload to cache ────────────────────────────────────────────
    const { error: uploadErr } = await supabase
      .storage
      .from("invoice-pdfs")
      .upload(cachePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      // Don't fail the request — PDF still generated, just not cached.
      log(`Cache upload failed (non-fatal): ${uploadErr.message}`);
    }

    // ── Audit ──────────────────────────────────────────────────────
    await supabase.from("audit_log").insert({
      org_id: invoice.org_id,
      actor_user_id: null,
      action: "pdf_generated_server",
      entity_type: "invoice",
      entity_id: invoice_id,
      after: {
        pdf_rev: invoice.pdf_rev,
        cache_path: cachePath,
        size_bytes: pdfBytes.byteLength,
      },
    });

    if (return_bytes) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: false,
          pdf_base64: bytesToBase64(pdfBytes),
          filename,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: signed } = await supabase
      .storage
      .from("invoice-pdfs")
      .createSignedUrl(cachePath, SIGNED_URL_TTL_SECONDS);

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        signed_url: signed?.signedUrl ?? null,
        filename,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[generate-invoice-pdf] ${message}`);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
