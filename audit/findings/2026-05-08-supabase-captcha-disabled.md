# Supabase CAPTCHA disabled — no credential-stuffing protection

**Severity:** medium
**Status:** open
**Area:** auth
**Discovered:** 2026-05-08
**Fixed:** —
**Fixed in:** —
**Affected components:** Supabase Auth project config

## Symptom

`security_captcha_enabled: false` at destination. With Google + Apple OAuth temporarily hidden behind feature flags (Google in verification, Apple unconfigured), email + password is currently the **only public sign-in path**. Combined with the weak default password policy (separate finding), this is a credential-stuffing vector.

## Root cause

Supabase Auth defaults `security_captcha_enabled` to false. Source environment had it disabled and that was inherited.

## Fix

Two-step:

1. Pick a CAPTCHA provider. Supabase supports hCaptcha and Cloudflare Turnstile. Turnstile is free + privacy-respecting + already on the same Cloudflare account that hosts the marketing site. Recommended.

2. Get a Turnstile site key + secret key at https://dash.cloudflare.com/?to=/:account/turnstile and configure Supabase:

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" \
  -d '{
    "security_captcha_enabled": true,
    "security_captcha_provider": "turnstile",
    "security_captcha_secret": "<TURNSTILE_SECRET_KEY>"
  }'
```

3. Frontend wiring required: add the Turnstile widget to Login.tsx + Signup.tsx, pass the resulting token in `signInWithPassword({ ..., options: { captchaToken } })`. Vue/React Turnstile components are widely available (e.g. `@marsidev/react-turnstile`).

## Verification

Post-change:
- Try sign-in without CAPTCHA token → expect Supabase to reject with `captcha_failed`
- Sign-in with valid Turnstile token → succeed

## Lessons / follow-ups

- This is medium severity rather than high because Supabase's existing rate limits (30 verify/5 min) provide partial protection.
- Pair with the password-policy finding before opening public sign-up.
- Consider Turnstile + the password-strength UI together in a single pre-launch security pass.
