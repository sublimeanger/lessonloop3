# /~oauth/initiate 404 after Lovable Cloud detach

**Severity:** critical
**Status:** fixed
**Area:** auth
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** 7b6c20c
**Affected components:** src/integrations/lovable/index.ts, src/pages/Login.tsx, src/pages/Signup.tsx, package.json

## Symptom

Sign-in entirely broken on the Netlify deploy. Clicking "Sign in with Google" hit `/~oauth/initiate?provider=google&...` and received a 404 — Lovable Cloud's hosted OAuth proxy was gone after the detach.

## Root cause

`@lovable.dev/cloud-auth-js` SDK pointed Google/Apple sign-in through Lovable's hosted `/~oauth/initiate` endpoint. After detaching from Lovable Cloud, that endpoint no longer existed, but the wrapper at `src/integrations/lovable/index.ts` still called it for the web branch. Native (Capacitor) branch was already on Supabase directly.

## Fix

Replaced the wrapper to call `supabase.auth.signInWithOAuth({provider, options: {redirectTo}})` directly. Removed the `@lovable.dev/cloud-auth-js` import and dependency. Kept the wrapper's exported surface (`lovable.auth.signInWithOAuth`) so Login/Signup pages didn't need changes. Apple branch returns clear "Apple sign-in is not yet configured" error toast since destination Supabase doesn't have Apple provider configured.

## Verification

- Login flow tested in browser: Google OAuth round-trip completes via Supabase auth
- Network tab shows direct calls to `xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/authorize` instead of `/~oauth/initiate`
- Bundle no longer contains "lovable" string references

## Lessons / follow-ups

When detaching from a managed platform, grep the codebase for hardcoded platform URLs (`/~`, `/_vercel/`, etc.) before deploying elsewhere. Sister fix shipped same-day: Netlify SPA fallback (commit 344a4ad) was the second Netlify-migration thing missing. Apple OAuth still unconfigured at destination — separate launch blocker.
