# xero-sync-invoice — Reference=LL-LL- cosmetic prefix bug

**Severity:** low
**Status:** fixed
**Area:** xero
**Discovered:** 2026-05-07
**Fixed:** 2026-05-10 (s24)
**Fixed in:** xero-sync-invoice v21 (Supabase Management API deploy in s24)
**Affected components:** supabase/functions/xero-sync-invoice/index.ts

## Symptom

Verified Xero invoice via direct API has Reference=`LL-LL-2026-00010` — function adds `LL-` to `invoice.invoice_number` which already begins with `LL-`.

## Root cause

Function code: `Reference: \`LL-${invoice.invoice_number}\``. Invoice numbers are already issued with the `LL-` prefix (e.g. `LL-2026-00010`). String template double-prefixes.

## Fix

**s24 stance recalibration (2026-05-10):** un-deferred. Xero is now DAY-ONE LAUNCH per Jamie's "world class" stance. Code-fix only (1 line at index.ts:207): use `invoice.invoice_number` directly instead of `\`LL-${invoice.invoice_number}\``. Deployed as xero-sync-invoice v21 via Supabase Management API in s24.

**Historical-data policy:** the 1 pre-fix invoice mapping (entity_type=invoice, count=1 per s24 audit) remains in Xero with `LL-LL-2026-00010` reference. Acceptable cosmetic — backfill not required for v1 launch. New invoices going forward use correct `LL-` prefix only.

## Verification

- xero-sync-invoice v21 deployed; readback confirms line 207 reads `Reference: invoice.invoice_number,` (no double prefix).
- 1 historical Xero invoice retains `LL-LL-...` reference (acceptable per s24 stance).
- Auth-gate proven via §27 Xero day-one contracts (s24): anon→4xx + no-auth→4xx both fire.
- Other 4 Xero findings (NOT NULL drift x2, FK name, unique constraint) verified holding via Supabase MCP execute_sql in s24.

## Lessons / follow-ups

If clean reports become a launch-day pain point, write a one-shot backfill script: loop active xero_connections → fetch Xero invoices via API → filter `Reference LIKE 'LL-LL-%'` → POST update with corrected reference. ~30-45 min implementation. Currently 1 affected invoice only — manual Xero CSV export/reimport may be quicker.
