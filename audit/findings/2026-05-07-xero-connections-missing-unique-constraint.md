# xero_connections missing UNIQUE on org_id — upsert failed

**Severity:** high
**Status:** fixed
**Area:** xero
**Discovered:** 2026-05-07
**Fixed:** 2026-05-07
**Fixed in:** ad_hoc_pre_cutover_drift_fixes.sql Section 7
**Affected components:** public.xero_connections

## Symptom

T3.1.A Xero OAuth smoke test: OAuth flow completed (token exchange + tenant fetch succeeded), but `xero-oauth-callback` redirected with `?xero_error=save_failed`. No row written to `xero_connections`.

## Root cause

Function calls `supabase.upsert(..., { onConflict: 'org_id' })`, which requires a unique constraint on `org_id`. Destination's table had only the PK (`id`); source has the UNIQUE constraint but the migration chain didn't capture it. Reason: `xero_connections` was created out-of-band on source — drift was anticipated for the table itself but not for its constraints.

## Fix

Added `xero_connections_org_id_key UNIQUE (org_id)` constraint.

## Verification

Retry of T3.1.A wrote a fresh row + audit_log entry. Subsequent retries upserted (no duplicate) confirming the unique constraint operational.

## Lessons / follow-ups

When recreating an out-of-band source table from inferred schema, capture indexes + constraints + RLS policies in addition to columns. Other deferred items still open for `xero_connections`: RLS policies (no policies exist; service_role bypass works for current edge-function-only access pattern).
