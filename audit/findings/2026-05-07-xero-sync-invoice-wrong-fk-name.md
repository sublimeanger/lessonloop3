# xero-sync-invoice — wrong FK name in PostgREST embed

**Severity:** high
**Status:** fixed
**Area:** xero
**Discovered:** 2026-05-07
**Fixed:** 2026-05-07
**Fixed in:** 025a423
**Affected components:** supabase/functions/xero-sync-invoice/index.ts

## Symptom

T3.1.B Xero functional sync smoke test (after T3.1.A succeeded): function returned `{"error":"Invoice not found"}` HTTP 404 for every invoice, regardless of validity.

## Root cause

Function code referenced `guardians!invoices_guardian_id_fkey` in PostgREST embed. Actual FK constraint is `invoices_payer_guardian_id_fkey` (FK column is `payer_guardian_id`, not `guardian_id`). PostgREST couldn't resolve the embed → `.single()` returned an error → function returned 404. Likely latent on source too — Xero sync was probably broken there but not exercised recently.

## Fix

One-line code change: `guardians!invoices_guardian_id_fkey` → `guardians!invoices_payer_guardian_id_fkey`.

## Verification

- Function returned HTTP 200 + xero_invoice_id post-fix
- Direct Xero API confirmed invoice exists: Type=ACCREC, Reference=LL-LL-2026-00010, Status=AUTHORISED, Total=792 GBP, Contact.Name=Michael Harris, 2 line items
- Guardian embed working

## Lessons / follow-ups

PostgREST FK embeds are string-typed and only fail at query time. (1) Reference actual constraint name from `pg_constraint`, not inferred shorthand. (2) Any embed using `!constraint_name` syntax should have a smoke test. Audit other xero-*, calendar-*, zoom-* functions for similar FK-embed names that may not match destination's actual constraint names.
