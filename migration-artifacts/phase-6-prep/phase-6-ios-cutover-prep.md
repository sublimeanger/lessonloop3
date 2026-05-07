# Phase 6 — iOS / Capacitor Cutover Prep (Inventory)

**Generated:** 2026-05-06
**Status:** inventory complete; changes are Phase 7 work

---

## Files needing changes at cutover

### Tier 1 — Build-time (3 files)

| File | What's hardcoded | Change to |
|---|---|---|
| `.env` | `VITE_SUPABASE_URL=https://ximxgnkpcswbvfrkkmjq.supabase.co` <br> `VITE_SUPABASE_PROJECT_ID="ximxgnkpcswbvfrkkmjq"` <br> `VITE_SUPABASE_PUBLISHABLE_KEY="<source anon JWT>"` | Destination URL + project ID + destination's `sb_publishable_4VxL8SzppJdtroj4IbmnXg_Ka530Y8f` (NOT legacy anon JWT — destination uses new key model) |
| `supabase/config.toml` (line 1) | `project_id = "ximxgnkpcswbvfrkkmjq"` | `project_id = "xmrhmxizpslhtkibqyfy"` |
| `src/integrations/supabase/client.ts` | (no hardcode — reads `import.meta.env`) | no change; `.env` swap is enough |

### Tier 2 — E2E tests (3 files)

| File | What's hardcoded |
|---|---|
| `tests/e2e/auth.setup.ts` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STORAGE_KEY = 'sb-ximxgnkpcswbvfrkkmjq-auth-token'` |
| `tests/e2e/supabase-admin.ts` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `tests/e2e/workflows/onboarding.spec.ts` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

Storage key changes to `sb-xmrhmxizpslhtkibqyfy-auth-token`. Recommend refactoring these to read from env at the same time.

### Tier 3 — Already done in Phase 5

- `supabase/functions/seed-e2e-data/index.ts` — destination ref added to `PRODUCTION_REFS` guard ✅
- `supabase/functions/seed-demo-data/index.ts` — same ✅

---

## iOS-specific items

### Apple Sign-In removal (D2)

3 files have `signInWithOAuth('apple', …)` for auth (NOT iCal calendar — those stay):
- `src/pages/Login.tsx` line 73
- `src/pages/Signup.tsx` line 67
- `src/integrations/lovable/index.ts` lines 15, 81 — drop `'apple'` from `provider:` union types

Cleanup pass — Phase 7, not now. Don't break the cutover by editing app code at the same time.

### Capacitor config

`capacitor.config.ts`: no source ref hardcoded. Bundle loaded from `webDir: 'dist'` (Vite output).

Leave commented-out `server.url` block as-is for App Store builds. Don't uncomment.

### iOS Info.plist

No URL types or associated domains configured. The OAuth deep-link callback flow in `signInWithOAuthNative` doesn't work natively on current iOS build — irrelevant once Apple Sign-In is removed (D2). For Google OAuth on iOS, the in-app browser flow uses `redirectTo: ${window.location.origin}/login` which resolves to `https://app.lessonloop.net/login` from the bundled app — covered by the redirect whitelist.

### Bundle ID inconsistency (D5: defer)

Three different values floating around:
- `capacitor.config.ts` → `net.lessonloop.app`
- `ios/App/App.xcodeproj/project.pbxproj` → `com.lessonloop.app`
- App Store Connect → unknown

D5 says defer. Don't touch as part of this cutover. Tracked as separate followup.

### Android intent filter

`AndroidManifest.xml` uses `app.lessonloop.com` (typo, should be `.net`). Same — defer to Android-build workstream, not cutover.

---

## Cutover-day file changes (concrete)

```bash
cd /home/user/lessonloop3

# Backup
cp .env .env.pre-cutover-backup
cp supabase/config.toml supabase/config.toml.pre-cutover-backup

# Update .env
cat > .env << 'EOF'
VITE_SUPABASE_PROJECT_ID="xmrhmxizpslhtkibqyfy"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_4VxL8SzppJdtroj4IbmnXg_Ka530Y8f"
VITE_SUPABASE_URL="https://xmrhmxizpslhtkibqyfy.supabase.co"
EOF

# Update config.toml
sed -i 's|^project_id = "ximxgnkpcswbvfrkkmjq"|project_id = "xmrhmxizpslhtkibqyfy"|' supabase/config.toml

# Verify
grep -E "VITE_SUPABASE" .env
grep "^project_id" supabase/config.toml
```

---

## What does NOT need changing

- `src/integrations/supabase/client.ts` — env-driven
- `src/integrations/supabase/types.ts` — type-only
- Edge function code — runtime env injection by destination platform
- `package.json` / `package-lock.json` — no Supabase URLs

---

## iOS build (Phase 7)

```bash
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode: scheme "App" / Release / "Any iOS Device (arm64)" → Product → Archive → Distribute App → App Store Connect → Upload.

Old app version on test devices keeps hitting source until updated. D6 says no rush on source decommission, so this isn't a constraint.
