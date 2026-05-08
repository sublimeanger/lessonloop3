# Supabase password policy is too weak (6-char minimum, no character requirements)

**Severity:** high
**Status:** fixed
**Area:** auth
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** Supabase Auth config update via Management API (no commit)
**Affected components:** Supabase Auth project config (`xmrhmxizpslhtkibqyfy`)

## Symptom

Pre-launch security review of `supabase/v1/projects/.../config/auth` reveals:

- `password_min_length: 6`
- `password_required_characters: null`

Translation: any newly-created LessonLoop user can choose `aaaaaa` as their password and the system accepts it. Trivial to brute-force; trivial to credential-stuff if attackers find a leaked password from another service.

## Root cause

Supabase's defaults for these fields are weak. Source environment inherited the same defaults; nobody tightened them. Likely an oversight from the early-development period when password policy wasn't on the radar.

## Fix

Tighten Supabase Auth password policy via Management API:

```bash
curl -s -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" \
  -d '{
    "password_min_length": 8,
    "password_required_characters": "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789"
  }'
```

This enforces:
- 8 characters minimum (NIST recommendation; gentler than 12 to avoid sign-up friction)
- At least one lowercase, one uppercase, one digit (Supabase's character-class syntax: colon-separated character sets, password must contain ≥1 from each)

The frontend already has `PasswordStrengthIndicator` (`src/components/auth/PasswordStrengthIndicator.tsx`) which scores up to 4 — so the UX is already prepared to surface strength to users.

## Verification

Post-change:
- Try signing up with a 6-char password → expect Supabase API to reject with a clear error
- Try signing up with a strong password → expect success
- Existing users with 6-char passwords continue to sign in (policy is enforced at signUp/passwordChange, not on existing password rows)

## Lessons / follow-ups

- Add this to a generic "new Supabase project bring-up checklist" alongside the GRANTs fix from `2026-05-05-public-schema-grants-missing.md`
- Consider also enabling `security_captcha_enabled` for credential-stuffing mitigation (separate finding)
- Long-term: enforce MFA for owner-role accounts via custom claim check at sign-in

**Pre-launch action item:** apply this tightening before public sign-up opens. ~30 seconds of work via the curl above.
