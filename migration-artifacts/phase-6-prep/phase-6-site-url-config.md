# Phase 6 — Site URL + Redirect Whitelist Configuration

**Generated:** 2026-05-06
**Destination project:** `xmrhmxizpslhtkibqyfy`

---

## Current state on destination

| Setting | Current | Target |
|---|---|---|
| `site_url` | `http://localhost:3000` (Supabase default) | `https://app.lessonloop.net` |
| `uri_allow_list` | empty | (full list below) |

---

## Target Site URL

```
https://app.lessonloop.net
```

This is the **canonical production URL** that:
- Supabase Auth redirects to after a magic-link click (when no other `redirectTo` is specified).
- Is referenced by the password-reset and email-confirmation links.
- Is what the iOS Capacitor build will load (when configured for production — Phase 7).

---

## Target Redirect URLs whitelist

Supabase requires every URL passed as `redirectTo` (in `signInWithOAuth`, `signInWithOtp`, `resetPasswordForEmail`, etc.) to match one of the whitelist patterns. **Wildcards are supported as glob patterns.**

Paste each line as a separate entry in the dashboard whitelist:

### Production
```
https://app.lessonloop.net
https://app.lessonloop.net/*
https://www.lessonloop.net
https://www.lessonloop.net/*
https://lessonloop.net
https://lessonloop.net/*
```

### Local dev (Vite default port 5173 + the legacy 3000 if any code still uses it)
```
http://localhost:5173
http://localhost:5173/*
http://localhost:3000
http://localhost:3000/*
```

### iOS app (Capacitor in-app browser flow)
The iOS app uses `signInWithOAuth(provider, { redirectTo: \`${window.location.origin}/login\` })` (per `src/integrations/lovable/index.ts:25`). When the app is loaded from `https://app.lessonloop.net`, `window.location.origin` evaluates to `https://app.lessonloop.net` — already covered above. No additional iOS-specific entries needed for the OAuth callback.

### Lovable preview (only if you keep using Lovable's preview deployments during development)
If you use Lovable preview URLs (`https://*.lovable.app` or similar), add a wildcard entry. Otherwise omit.
```
https://*.lovable.app
https://*.lovable.app/*
```

> **Decision needed:** Do you still use Lovable previews? If yes, add these. If you're now developing entirely against your own Vite + Supabase stack, skip them.

### Total list (12 entries, plus optional 2 for Lovable)

```
https://app.lessonloop.net
https://app.lessonloop.net/*
https://www.lessonloop.net
https://www.lessonloop.net/*
https://lessonloop.net
https://lessonloop.net/*
http://localhost:5173
http://localhost:5173/*
http://localhost:3000
http://localhost:3000/*
```

---

## Setup steps (manual)

1. Go to [Supabase Dashboard → xmrhmxizpslhtkibqyfy → Authentication → URL Configuration](https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/url-configuration)
2. **Site URL:** paste `https://app.lessonloop.net`
3. **Redirect URLs:** add each line from the list above (one entry per line; the dashboard expands wildcards on save)
4. Save

Alternative — programmatic via Mgmt API (built into the cutover runbook):

```bash
curl -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" \
  -d '{
    "site_url": "https://app.lessonloop.net",
    "uri_allow_list": "https://app.lessonloop.net,https://app.lessonloop.net/*,https://www.lessonloop.net,https://www.lessonloop.net/*,https://lessonloop.net,https://lessonloop.net/*,http://localhost:5173,http://localhost:5173/*,http://localhost:3000,http://localhost:3000/*"
  }'
```

The Mgmt API expects `uri_allow_list` as a **comma-separated string** (single field), not an array.

---

## Domain inconsistency flagged for follow-up

I found a **typo in `android/app/src/main/AndroidManifest.xml`** that may need fixing before iOS/Android cutover (T6.4 covers iOS; this is the Android side):

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="app.lessonloop.com" />   <!-- TYPO: should be .net -->
</intent-filter>
```

Everywhere else in the codebase uses `lessonloop.net`. This Android intent filter uses `lessonloop.com`. Implication: Android App Links currently won't auto-open the app from web links to `app.lessonloop.net`. This should be fixed regardless of cutover.

**Note for cutover:** if you're deploying Android, fix this in Phase 7 along with the iOS cutover changes.

---

## Verification queries (post-config)

```bash
# Confirm site_url + uri_allow_list are populated
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" | \
  python3 -c "
import json,sys
d = json.load(sys.stdin)
print('site_url:', d['site_url'])
print('uri_allow_list:')
for u in (d.get('uri_allow_list','') or '').split(','):
    print(f'  {u}')
"
```

Expected: `site_url` = `https://app.lessonloop.net`; `uri_allow_list` = 10–12 entries listed above.
