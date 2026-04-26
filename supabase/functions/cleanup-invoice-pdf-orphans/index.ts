/**
 * Journey 11 Phase 1 — cleanup-invoice-pdf-orphans
 *
 * Daily sweep of the invoice-pdfs bucket. Deletes any cached PDF whose
 * embedded rev is below the parent invoice's current pdf_rev (the
 * invoice has been mutated and a fresh PDF was rendered at the new
 * rev — the old object is now an orphan that storage retains forever
 * unless purged). Also deletes every cached PDF for invoices that
 * have been deleted entirely.
 *
 * Path scheme set by C1: {org_id_uuid}/{invoice_id_uuid}_{rev_int}.pdf
 *
 * Auth: Pattern C cron (x-cron-secret → INTERNAL_CRON_SECRET).
 * Self-audits each sweep into platform_audit_log.
 *
 * Mirrors the cleanup-webhook-retention shape (T05-P2-C2) for
 * consistency with the other daily retention sweeps.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronAuth } from "../_shared/cron-auth.ts";

const log = (msg: string) => console.log(`[cleanup-invoice-pdf-orphans] ${msg}`);

// Path format: {org_id_uuid}/{invoice_id_uuid}_{rev_int}.pdf
function parsePath(name: string): { orgId: string; invoiceId: string; rev: number } | null {
  const parts = name.split("/");
  if (parts.length !== 2) return null;
  const [orgId, file] = parts;
  const m = file.match(/^([0-9a-f-]{36})_(\d+)\.pdf$/i);
  if (!m) return null;
  return { orgId, invoiceId: m[1], rev: parseInt(m[2], 10) };
}

serve(async (req) => {
  const cronAuthError = validateCronAuth(req);
  if (cronAuthError) return cronAuthError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    log("Starting orphan sweep");

    // ── Enumerate cached objects ──────────────────────────────────
    // Try the direct PostgREST query against storage.objects first.
    // Most projects don't expose the storage schema to PostgREST so
    // this typically fails with "schema not exposed" — the RPC
    // fallback (list_invoice_pdf_objects, defined in the C7 migration)
    // performs the same SELECT under SECURITY DEFINER and is the
    // path that normally runs. Both code paths converge into
    // allObjects.
    const allObjects: { name: string; created_at?: string }[] = [];

    // deno-lint-ignore no-explicit-any
    const { data: objects, error: objErr } = await (supabase as any)
      .from("storage.objects")
      .select("name, created_at")
      .eq("bucket_id", "invoice-pdfs")
      .order("name", { ascending: true })
      .limit(20000);

    if (objErr) {
      log(`storage.objects direct query failed: ${objErr.message} — falling back to RPC`);
      const { data: rpcData, error: rpcErr } = await supabase.rpc("list_invoice_pdf_objects");
      if (rpcErr) {
        await supabase.from("platform_audit_log").insert({
          action: "invoice_pdf_orphan_sweep_failed",
          source: "cleanup-invoice-pdf-orphans",
          severity: "error",
          details: { error_message: rpcErr.message },
        });
        return new Response(
          JSON.stringify({ success: false, error: rpcErr.message }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
      allObjects.push(...((rpcData ?? []) as typeof allObjects));
    } else {
      allObjects.push(...((objects ?? []) as typeof allObjects));
    }

    log(`Total objects to inspect: ${allObjects.length}`);

    // ── Group cached objects by invoice id, capture all known revs ─
    const byInvoice = new Map<string, { name: string; rev: number }[]>();
    for (const obj of allObjects) {
      const parsed = parsePath(obj.name);
      if (!parsed) continue;
      const arr = byInvoice.get(parsed.invoiceId) ?? [];
      arr.push({ name: obj.name, rev: parsed.rev });
      byInvoice.set(parsed.invoiceId, arr);
    }

    // ── Look up the current pdf_rev for each invoice we have rows for
    const invoiceIds = Array.from(byInvoice.keys());
    const currentRevs = new Map<string, number>();
    const batchSize = 100;
    for (let i = 0; i < invoiceIds.length; i += batchSize) {
      const batch = invoiceIds.slice(i, i + batchSize);
      const { data: invs, error: invErr } = await supabase
        .from("invoices")
        .select("id, pdf_rev")
        .in("id", batch);
      if (invErr) {
        log(`Invoice lookup batch failed (continuing): ${invErr.message}`);
        continue;
      }
      for (const inv of invs ?? []) {
        currentRevs.set(inv.id as string, inv.pdf_rev as number);
      }
    }

    // ── Compute orphan list ───────────────────────────────────────
    // Orphan rule:
    //   - Invoice present + cached.rev <  invoices.pdf_rev   → delete
    //   - Invoice deleted (no row for invoice_id at all)     → delete every cached rev
    const toDelete: string[] = [];
    for (const [invoiceId, cached] of byInvoice) {
      const currentRev = currentRevs.get(invoiceId);
      if (currentRev === undefined) {
        for (const c of cached) toDelete.push(c.name);
        continue;
      }
      for (const c of cached) {
        if (c.rev < currentRev) toDelete.push(c.name);
      }
    }

    log(`Orphans identified: ${toDelete.length}`);

    // ── Delete in chunks of 100 ───────────────────────────────────
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error: delErr } = await supabase
        .storage
        .from("invoice-pdfs")
        .remove(chunk);
      if (delErr) {
        log(`Delete batch failed (continuing): ${delErr.message}`);
        continue;
      }
      deleted += chunk.length;
    }

    const result = {
      objects_inspected: allObjects.length,
      orphans_identified: toDelete.length,
      orphans_deleted: deleted,
      ran_at: new Date().toISOString(),
    };

    await supabase.from("platform_audit_log").insert({
      action: "invoice_pdf_orphan_sweep",
      source: "cleanup-invoice-pdf-orphans",
      severity: "info",
      details: result,
    });

    log(`Sweep complete: ${JSON.stringify(result)}`);
    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[cleanup-invoice-pdf-orphans] ${message}`);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
