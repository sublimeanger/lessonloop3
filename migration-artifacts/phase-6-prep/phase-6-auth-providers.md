# Phase 6 — Auth Provider Configuration

**Generated:** 2026-05-06
**Destination project:** `xmrhmxizpslhtkibqyfy`

---

## Current state on destination

| Provider | Enabled | Action |
|---|---|---|
| Email/password | ✅ enabled | none — already configured |
| Google OAuth | ❌ disabled | **needs setup** (see below) |
| Apple Sign-In | ❌ disabled | **stays disabled** (D2 — being removed from app) |
| All other providers | ❌ disabled | none |

| URL setting | Current | Target |
|---|---|---|
| `site_url` | `http://localhost:3000` | `https://app.lessonloop.net` |
| `uri_allow_list` | empty | (see `phase-6-site-url-config.md`) |

---

## Google OAuth setup (D1: reuse source's client, add destination callback)

Reuse the same Google OAuth client ID/secret currently in use on source. Just add destination's callback URL to the existing client's authorized list.

### Steps

**A. Google Cloud Console — add destination callback URL**

1. [Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Open your existing LessonLoop OAuth 2.0 Client (Web application)
3. Under **Authorized redirect URIs**, click "ADD URI" and paste:
   ```
   https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/callback
   ```
4. Save. Leave source's URI in place too (D6: source stays around).

**B. Supabase Auth dashboard — destination**

1. [Auth → Providers](https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/providers)
2. Find **Google**, click "Enable"
3. Paste the same Client ID + Client Secret values your source project uses
4. Save

**C. Edge function secrets**

Same `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` values also go into edge function secrets:
```bash
supabase secrets set --project-ref xmrhmxizpslhtkibqyfy GOOGLE_CLIENT_ID=<source's value>
supabase secrets set --project-ref xmrhmxizpslhtkibqyfy GOOGLE_CLIENT_SECRET=<source's value>
```

(These are used by app code at runtime for Google Calendar integration etc., separately from the Auth provider config.)

### Verify

```bash
# Confirm Google enabled
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print('google_enabled:', d['external_google_enabled'])"
# Should be: True
```

Curl test — should redirect to a Google sign-in URL with the right `client_id`:
```bash
curl -I "https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/authorize?provider=google"
```

---

## Apple Sign-In (D2: remove from app)

**Decision:** don't enable Apple Sign-In on destination. Remove the code paths from the app.

**Code references to clean up** (Phase 7 work, not now):

| File | Lines | What to remove |
|---|---|---|
| `src/pages/Login.tsx` | line 73 | `signInWithOAuth('apple', …)` call + the "Continue with Apple" button |
| `src/pages/Signup.tsx` | line 67 | same |
| `src/integrations/lovable/index.ts` | lines 15, 81 | drop `'apple'` from the `provider:` union types in `signInWithOAuthNative` and `signInWithOAuth` wrapper |

**NOT to be removed** (Apple iCal calendar integration is a separate feature, kept):
- `src/hooks/useCalendarConnections.ts` — `provider: 'apple'` here means iCal calendar sync, not Apple Sign-In
- `src/components/settings/CalendarSyncHealth.tsx` — same
- `supabase/functions/ical-expiry-reminder/index.ts`, `supabase/functions/calendar-ical-feed/index.ts` — same

That distinction matters: `external_apple_enabled` (Auth provider config) vs `calendar_connections.provider = 'apple'` (app feature) are unrelated.

---

## Site URL + redirect whitelist

See `phase-6-site-url-config.md` for the 10-entry list.
