# Phase 6 Tier 3.2 (Zoom) — full E2E deferred to cutover

**Severity:** medium
**Status:** deferred
**Area:** zoom
**Discovered:** 2026-05-07
**Fixed:** —
**Fixed in:** 68c919d (closure entry)
**Affected components:** supabase/functions/zoom-oauth-{start,callback}, src/pages/ZoomOAuthCallback.tsx

## Symptom

Tier 3.2 (Zoom) couldn't complete full end-to-end OAuth verification pre-cutover. Server-side checks passed but round-trip can't be exercised against destination until frontend rebuilt.

## Root cause

Zoom's OAuth flow is **frontend-mediated** (unlike Xero/Google which redirect directly to a Supabase edge function). `zoom-oauth-start` hardcodes `redirect_uri` to `${FRONTEND_URL}/auth/zoom/callback`; React component reads `import.meta.env.VITE_SUPABASE_URL` and forwards `code+state` to that URL. Pre-cutover the deployed frontend was built with source's URL.

## Fix

Server-side validated only. zoom-oauth-callback ACTIVE, verify_jwt: false, gracefully rejects synthetic invalid state (HTTP 400) and bogus code (HTTP 302). Direct Zoom token endpoint probe confirmed credentials accepted.

## Verification

Server-side: 3/3 synthetic tests passed. Full E2E pending Phase 7 6.B.

## Lessons / follow-ups

Watch function logs for `console.error` from `zoom_meeting_mappings` inserts at cutover — likely same NOT NULL drift as `xero_entity_mappings`.
