# calendar-oauth-callback rejected as UNAUTHORIZED_NO_AUTH_HEADER

**Severity:** critical
**Status:** fixed
**Area:** calendar
**Discovered:** 2026-05-07
**Fixed:** 2026-05-07
**Fixed in:** b3b762c
**Affected components:** supabase/config.toml, supabase/functions/calendar-oauth-callback/index.ts

## Symptom

Google's OAuth redirect to `calendar-oauth-callback` returned HTTP 401 `UNAUTHORIZED_NO_AUTH_HEADER`. The Supabase function gateway rejected the callback before the function body could run, breaking Google Calendar connect entirely.

## Root cause

`calendar-oauth-callback` defaulted to `verify_jwt = true`. OAuth providers don't send a Supabase JWT — they redirect with `code+state` only. Sister functions `xero-oauth-callback` and `zoom-oauth-callback` already had `verify_jwt = false` set; calendar-oauth-callback was missed during Phase 5 W1 grep because it didn't fit Pattern A (service-role Bearer) or Pattern B (cron secret). OAuth callbacks are a third, distinct pattern.

## Fix

Added `[functions.calendar-oauth-callback] verify_jwt = false` to `supabase/config.toml`. Redeployed.

## Verification

- OAuth round-trip completed: Google redirect reached the function, code+state exchanged, tokens persisted
- `calendar_connections` row written with valid access/refresh tokens, audit_log entry recorded

## Lessons / follow-ups

OAuth callbacks form a third `verify_jwt = false` pattern. Any new OAuth provider integration must be added to the verify_jwt = false list explicitly.
