# xero-sync-payment silent INSERT failure on xero_entity_mappings

**Severity:** high
**Status:** fixed
**Area:** xero
**Discovered:** 2026-05-07
**Fixed:** 2026-05-07
**Fixed in:** 9c72ca3
**Affected components:** supabase/functions/xero-sync-payment/index.ts

## Symptom

Same shape as xero-sync-invoice: function returned HTTP 200, successfully POSTed payment to Xero, but no row persisted to `xero_entity_mappings`. Idempotency check on subsequent calls always missed → would create duplicate Xero payments on retry.

## Root cause

Same drift class as xero-sync-invoice (commit 2c4b410). Payment-mapping INSERT was missing 3 NOT NULL columns (`connection_id`, `sync_status`, `last_synced_at`) and used same fire-and-forget pattern. Idempotency logic itself was correct (early-return on existing-mapping); just never had any mappings to find.

## Fix

Added 3 missing NOT NULL columns + `const { error } = ...` capture + `console.error` on insert failure.

## Verification

Preemptive fix paired with calendar/zoom-sync-lesson fixes in commit 9c72ca3. Mapping persistence verified by sibling test.

## Lessons / follow-ups

Third instance of fire-and-forget INSERT anti-pattern. Consider lint/grep pre-commit check: any `await supabase.from(...).insert(...)` without `{ error }` destructure is a candidate bug.
