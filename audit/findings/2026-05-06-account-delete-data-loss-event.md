# account-delete invoked during smoke test — admin user wiped

**Severity:** high
**Status:** fixed
**Area:** auth
**Discovered:** 2026-05-06
**Fixed:** 2026-05-06
**Fixed in:** —
**Affected components:** supabase/functions/account-delete (no code change), smoke-test harness (process change)

## Symptom

Phase 5 Task Y smoke-test harness iterated all 40 "pure-DB" edge functions with empty body `{}` and the admin user's JWT. First function alphabetically was `account-delete`, which returned `{"success":true}` HTTP 200 — and actually deleted the JWT bearer's own account. All ~39 subsequent calls 401'd because the JWT was now for a deleted user.

## Root cause

Two compounding errors in smoke-test design:
1. Classifying functions as "pure-DB" (no HTTP egress) and treating that as a proxy for "safe to invoke." Pure-DB just means won't fail externally — can still be deeply destructive against the database itself.
2. Iterating ALL functions in the set unattended with the same JWT — guaranteed the first destructive function would compromise the JWT identity for the rest of the run.

`account-delete`'s contract is empty body = "delete the calling user's own account" — by design.

## Fix

No code change. Process change:
- Restored deleted user via Admin API + targeted UPDATEs on `auth.users`, `public.profiles`, `public.org_memberships`, `public.guardians`. Restoration wrapped in `BEGIN; SET LOCAL session_replication_role='replica'; …; COMMIT;` to suppress audit triggers.
- Codified safe-vs-unsafe sets for unattended sweeps.

## Verification

- auth.users count restored 128 → 129. Target user present with original timestamps
- Profile values match source. org_memberships row present. Guardian row's user_id relinked
- Drift residual: new auth.identities row (timestamps differ ~1 month) — operationally insignificant

## Lessons / follow-ups

"Pure-DB" classification ≠ "safe to invoke." Codified safe sets:
- **OK to sweep:** booking-get-slots, calendar-ical-feed, invite-get, profile-ensure, gdpr-export, generate-invoice-pdf, migration-dump
- **NOT OK to sweep:** account-delete, gdpr-delete, csv-import-execute, cleanup-*, seed-*, *-expiry, *-overdue-check, send-invoice-email*, xero-*, recurring-billing-scheduler, create-billing-run, mark-messages-read, invite-accept, onboarding-setup, process-term-adjustment, continuation-respond, bulk-process-continuation, notify-makeup-match, looopassist-execute, auto-pay-* — human-supervised single calls only
