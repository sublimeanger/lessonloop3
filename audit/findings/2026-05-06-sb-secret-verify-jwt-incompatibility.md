# sb_secret + verify_jwt incompatibility — 24 functions reconfigured

**Severity:** high
**Status:** fixed
**Area:** auth
**Discovered:** 2026-05-06
**Fixed:** 2026-05-06
**Fixed in:** —
**Affected components:** supabase/config.toml (24 function entries)

## Symptom

Phase 5 Task Y smoke test of `generate-invoice-pdf` returned HTTP 401 "Service-role authentication required" regardless of which key format was sent in `Authorization: Bearer …`.

## Root cause

Destination project uses the **new "Publishable + Secret" API key model** alongside legacy JWT keys. Per Supabase docs: *"Edge Functions only support JWT verification via the anon and service_role JWT-based API keys. You will need to use the --no-verify-jwt option when using publishable and secret keys."*

- Platform auto-injects `SUPABASE_SERVICE_ROLE_KEY` into edge function runtime as the **`sb_secret_*` value** (NOT the legacy JWT).
- Function gateway's `verify_jwt = true` path requires JWT-format Bearer and rejects `sb_secret_*` with `UNAUTHORIZED_INVALID_JWT_FORMAT`.
- Mutually exclusive when a function does `if (authHeader !== \`Bearer ${SR_KEY}\`)` because SR_KEY resolves to sb_secret_* but gateway requires JWT.
- Mgmt API blocks `SUPABASE_*` prefixed secrets, so platform-injected value can't be overridden.

## Fix

Added `verify_jwt = false` to 24 functions in config.toml:
- **7 service-role-Bearer:** generate-invoice-pdf, send-auto-pay-alert, send-auto-pay-failure-notification, send-dispute-notification, send-invoice-email-internal, send-recurring-billing-alert, send-refund-notification
- **17 cron-secret:** admin-backfill-default-pm, auto-pay-final-reminder, cleanup-invoice-pdf-orphans, cleanup-orphaned-resources, cleanup-webhook-retention, credit-expiry, credit-expiry-warning, cron-health-watchdog, ical-expiry-reminder, overdue-reminders, recurring-billing-scheduler, streak-notification, trial-expired, trial-reminder-{1,3,7}day, trial-winback

Excluded csv-import-execute, looopassist-execute (use user-JWT auth, genuinely need verify_jwt = true).

## Verification

- generate-invoice-pdf with Bearer sb_secret_… → 200, signed URL for actual invoice PDF
- migration-dump regression: 200, no change
- invoice-overdue-check with x-cron-secret → 200, recalc'd 8 invoices
- Negative control wrong x-cron-secret → 401 (auth still enforced by _shared/cron-auth.ts)

## Lessons / follow-ups

Function auth taxonomy:
- (A) end-user JWT → verify_jwt=true
- (B) service-role Bearer → verify_jwt=false
- (C) cron secret → verify_jwt=false
- (D) OAuth callback (code+state) → verify_jwt=false

Any new function in B/C/D categories must be added to verify_jwt=false list explicitly.
