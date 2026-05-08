# Supabase Auth pre-launch tightening — HIBP, security-event emails, password-reauth

**Severity:** medium
**Status:** fixed
**Area:** auth
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** Supabase Auth config update via Management API (no commit)
**Affected components:** Project `xmrhmxizpslhtkibqyfy` auth config

## Symptom

Pre-launch security review of `/v1/projects/.../config/auth` revealed several defaults that should be tightened before public sign-up opens. None of these are critical alone, but cumulatively they widen the attack surface.

| flag | before | after |
|---|---|---|
| `password_hibp_enabled` | false | true |
| `security_update_password_require_reauthentication` | false | true |
| `mailer_notifications_password_changed_enabled` | false | true |
| `mailer_notifications_email_changed_enabled` | false | true |
| `mailer_notifications_mfa_factor_enrolled_enabled` | false | true |
| `mailer_notifications_mfa_factor_unenrolled_enabled` | false | true |
| `mailer_notifications_identity_linked_enabled` | false | true |
| `mailer_notifications_identity_unlinked_enabled` | false | true |

## Risk per flag

1. **HIBP**: server-side check rejects passwords found in known breach corpora. Frontend already does its own pwnedpasswords check; this adds defence in depth so passwords leaked AFTER frontend deploy still get rejected on signup/change.
2. **Reauth on password change**: prevents an attacker with momentary access to an unlocked browser from changing the password (locking out the legitimate user).
3. **Security-event emails**: when someone changes the password / email / MFA / linked identity, the legitimate user is notified at the previous email. Without this, an account takeover proceeds in silence.

## Fix

Single Management API PATCH:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" \
  -d '{
    "password_hibp_enabled": true,
    "security_update_password_require_reauthentication": true,
    "mailer_notifications_password_changed_enabled": true,
    "mailer_notifications_email_changed_enabled": true,
    "mailer_notifications_mfa_factor_enrolled_enabled": true,
    "mailer_notifications_mfa_factor_unenrolled_enabled": true,
    "mailer_notifications_identity_linked_enabled": true,
    "mailer_notifications_identity_unlinked_enabled": true
  }'
```

The notification email templates already exist (Supabase ships defaults; they could be re-themed with the LessonLoop brand later but the plain ones are functional and clearly indicate "if this wasn't you, contact support").

## Verification

Post-change:
- Try signing up with a known-pwned password (e.g. `Password123`) → expect rejection
- Change password from app → expect re-auth prompt + confirmation email
- Change email → expect old email gets a "your email has been changed" notification
- Enroll TOTP MFA → expect notification email

## Lessons / follow-ups

- Already-flagged related findings: weak password policy (fixed `2026-05-08-supabase-password-policy-too-weak.md`) and CAPTCHA disabled (still open `2026-05-08-supabase-captcha-disabled.md`).
- Consider also re-theming the `mailer_templates_*_notification_content` HTML to match the branded confirmation/recovery emails. Current ones are bare `<h2>` style.
- `passkey_enabled` / `mfa_web_authn_enroll_enabled` / `mfa_phone_enroll_enabled` all remain false. TOTP is the only MFA available. Adequate for launch, but adding passkey post-launch is a nice usability win.
- `security_sb_forwarded_for_enabled` is false — if Cloudflare front-fronts the auth endpoints, enabling this would let Supabase log real client IPs through the X-Forwarded-For header. Pair with the WAF rules finding.
