# xero-sync-invoice silent INSERT failure on xero_entity_mappings

**Severity:** high
**Status:** fixed
**Area:** xero
**Discovered:** 2026-05-07
**Fixed:** 2026-05-07
**Fixed in:** 2c4b410
**Affected components:** supabase/functions/xero-sync-invoice/index.ts

## Symptom

Xero sync function returned HTTP 200 and successfully created Xero invoices, but no rows persisted to `xero_entity_mappings`. Subsequent re-syncs of the same invoice would create duplicates in Xero because no mapping existed for the idempotency lookup.

## Root cause

`xero_entity_mappings` on destination has 3 NOT NULL columns without defaults: `connection_id`, `sync_status`, `last_synced_at`. Both INSERTs (contact mapping ~line 173, invoice mapping ~line 257) only supplied `org_id`, `entity_type`, `local_id`, `xero_id`. The `await supabase.from(...).insert(...)` was fire-and-forget — no `error` destructure, no error logging — so the NOT NULL violations were silently swallowed and the function returned success regardless. Latent on source too; just not exercised because mappings table was empty there as well.

## Fix

Updated both INSERTs to populate `connection_id` (= `connection.id`), `sync_status` (= `'synced'`), `last_synced_at` (= `new Date().toISOString()`). Added `const { error } = await ...` capture + `console.error` so future silent failures surface in logs.

## Verification

- First post-fix sync wrote 2 rows (contact + invoice mapping) with all NOT NULL columns populated
- Second sync of same invoice returned same `xero_invoice_id`, zero new rows — full idempotency
- Direct Xero API confirmed invoice present with expected reference + line items

## Lessons / follow-ups

Same fire-and-forget INSERT pattern existed in `xero-sync-payment` (caught later, commit 9c72ca3). Audit other sync functions for fire-and-forget writes against tables with NOT NULL constraints. `zoom_meeting_mappings` may have the same drift — flag for Phase 7 6.B.
