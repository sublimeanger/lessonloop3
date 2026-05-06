# Phase 6 — Auth Provider Configuration Audit

**Generated:** 2026-05-06
**Destination project:** `xmrhmxizpslhtkibqyfy`

---

## Current state on destination

### Providers
| Provider | Enabled | Client ID | Client Secret |
|---|---|---|---|
| Email/password | ✅ enabled | — | — |
| Google OAuth | ❌ disabled | None | None |
| All other (Apple, Azure, GitHub, etc.) | ❌ disabled | — | — |
| Anonymous users | ❌ disabled | — | — |
| Phone | ❌ disabled | — | — |

### URL configuration
| Setting | Current | Target |
|---|---|---|
| `site_url` | `http://localhost:3000` (Supabase default) | `https://app.lessonloop.net` |
| `uri_allow_list` | empty | (see T6.3 for full list) |

### Current auth.users distribution
- **email provider:** 119 users
- **google provider:** 10 users
- **Total:** 129 users (matches Phase 4)

---

## Source-state vs destination-state gap

| Provider | Source | Destination | Action |
|---|---|---|---|
| Email/password | enabled (used by 119 users) | enabled | none — already configured |
| Google OAuth | enabled (used by 10 users) | disabled | **needs full setup** |

Phase 1 inventory mentioned 13 Google users + 116 email/password — the actual numbers (10/119) likely reflect post-source-dump activity. The user counts match `auth.users` count from `raw_app_meta_data->>'provider'`.

Other providers we don't need to enable: Apple, Azure, etc. — none in use on source.

---

## Action 1 — Google OAuth setup steps (manual; you, the user)

### A. Get redirect URI ready for Google Cloud Console

Supabase auto-generates the OAuth callback URL based on the project ref:

> **Supabase callback URL:** `https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/callback`

This is the URL that needs to be **added** to your Google Cloud Console OAuth 2.0 Client's "Authorized redirect URIs" list (not replacing the source's URL — both should be present until source is decommissioned).

### B. Google Cloud Console steps

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your LessonLoop OAuth 2.0 Client ID (Web application type)
3. Under **Authorized redirect URIs**, click "ADD URI" and paste:
   ```
   https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/callback
   ```
4. Save. Don't remove the source's URI — leave both until cutover is complete.
5. Note the existing **Client ID** (`GOOGLE_CLIENT_ID`) and **Client secret** (`GOOGLE_CLIENT_SECRET`); these become the secrets you'll set on destination.
6. Optional: also add the **Authorized JavaScript origins** for `https://app.lessonloop.net` if not already present.

### C. Supabase Auth dashboard steps (destination)

1. Go to [Supabase Dashboard → xmrhmxizpslhtkibqyfy → Authentication → Providers](https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/providers)
2. Find **Google** in the list, click "Enable"
3. Paste:
   - **Client ID:** the value from Google Cloud Console (also the value going into the `GOOGLE_CLIENT_ID` edge function secret)
   - **Client Secret:** the value from Google Cloud Console (also `GOOGLE_CLIENT_SECRET`)
   - **Skip nonce check:** leave unchecked
   - **Allowed Client IDs (additional):** leave empty unless you have multiple Google OAuth clients (e.g., separate iOS native client)
4. Click "Save"

> **Note:** the values for `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` go into TWO places:
> - The Auth provider config (above), used by the Supabase Auth service for the OAuth handshake
> - The edge function secrets (`supabase secrets set …`), used by app code that needs Google APIs at runtime (Calendar sync etc.)
>
> They're the same values, just stored in two places.

### D. Verify after enabling

- Curl test: `curl https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/authorize?provider=google` should redirect (302) to a Google sign-in URL with the right `client_id` query param.
- App test: open destination's frontend (after Phase 7), click "Continue with Google", should bounce through Google and land back authenticated.

---

## Action 2 — Apple OAuth (NOT NEEDED for cutover, but for iOS app)

iOS Capacitor builds use `signInWithOAuth("apple", …)` as well — see `src/integrations/lovable/index.ts:81`. Source uses Lovable's wrapper, but destination needs native Supabase Auth. Apple Sign-In requires:
- Apple Developer account → Sign in with Apple capability for your bundle ID
- Service ID + redirect URI
- Auth key (`.p8` file)

Apple Sign-In wasn't in scope for the secret-fetch checklist — verify whether it was in actual use on source (presence of `external_apple_*` config + any Apple-provider users). Currently destination shows zero Apple users (`auth.users.raw_app_meta_data->>'provider'` only returns 'email' and 'google'), so this can be deferred.

If Apple Sign-In isn't used in production right now: remove it from the iOS code (`signInWithOAuth("apple")` calls in Login.tsx/Signup.tsx) before Phase 7.

---

## Action 3 — Site URL + redirect whitelist

See `phase-6-site-url-config.md` (T6.3 output) for the full list to paste.

Settings → Authentication → URL Configuration:
- Site URL: `https://app.lessonloop.net`
- Redirect URLs whitelist: see T6.3

---

## Verification queries (run after dashboard config, before Phase 7)

```bash
# Confirm Google enabled with correct client_id (last 4 digits)
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print('google_enabled:', d['external_google_enabled']); cid=d['external_google_client_id'] or ''; print('google_client_id ends in:', cid[-12:] if cid else 'EMPTY')"

# Confirm site_url + uri_allow_list are populated
curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print('site_url:', d['site_url']); print('uri_allow_list:', d['uri_allow_list'])"
```

Both should return non-empty production values.

---

## Outstanding questions for you (decision needed before continuing Phase 6)

- [ ] Are the same `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from source going to be reused for destination, or are you creating new ones?
- [ ] Should Apple Sign-In be enabled on destination, or removed from the iOS app?
- [ ] Are you keeping source's project running in parallel (read-only/disabled) for a rollback window, or hard-cutover?
