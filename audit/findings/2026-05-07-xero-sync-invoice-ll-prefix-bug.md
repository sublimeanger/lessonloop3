# xero-sync-invoice — Reference=LL-LL- cosmetic prefix bug

**Severity:** low
**Status:** deferred
**Area:** xero
**Discovered:** 2026-05-07
**Fixed:** —
**Fixed in:** —
**Affected components:** supabase/functions/xero-sync-invoice/index.ts

## Symptom

Verified Xero invoice via direct API has Reference=`LL-LL-2026-00010` — function adds `LL-` to `invoice.invoice_number` which already begins with `LL-`.

## Root cause

Function code: `Reference: \`LL-${invoice.invoice_number}\``. Invoice numbers are already issued with the `LL-` prefix (e.g. `LL-2026-00010`). String template double-prefixes.

## Fix

DEFERRED. Source has the same bug. Fixing in destination only would cause behaviour change for any historical Xero data already synced from source. Defer to post-cutover code-cleanup pass.

## Verification

Cosmetic only — no functional impact. Xero accepts the double-prefixed reference; reports look ugly.

## Lessons / follow-ups

When fixing, decide policy on existing Xero references: leave historical (LL-LL-...) untouched, or one-time backfill to strip duplicate prefix. Recommend the latter for clean reports.
