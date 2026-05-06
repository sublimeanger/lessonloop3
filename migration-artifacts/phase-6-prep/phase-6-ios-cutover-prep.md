# Phase 6 — iOS / Capacitor Cutover Prep (Inventory only — NO changes yet)

**Generated:** 2026-05-06
**Status:** inventory complete; changes are Phase 7 work
**Scope:** identifies every file that hardcodes the source project ref or other source-specific values that need swapping at cutover.

---

## Files needing changes at cutover (sorted by criticality)

### Tier 1 — Will break the app immediately if not changed (3 files)

| File | What's hardcoded | What to change to |
|---|---|---|
| `.env` (root) | `VITE_SUPABASE_URL=https://ximxgnkpcswbvfrkkmjq.supabase.co` <br> `VITE_SUPABASE_PROJECT_ID="ximxgnkpcswbvfrkkmjq"` <br> `VITE_SUPABASE_PUBLISHABLE_KEY="<source's anon JWT>"` | Destination URL `https://xmrhmxizpslhtkibqyfy.supabase.co`, project ID `xmrhmxizpslhtkibqyfy`, and the destination's `sb_publishable_*` key (NOT the legacy anon JWT — destination uses the new key model) |
| `supabase/config.toml` (line 1) | `project_id = "ximxgnkpcswbvfrkkmjq"` | `project_id = "xmrhmxizpslhtkibqyfy"` |
| `src/integrations/supabase/client.ts` | (no hardcode — reads from `import.meta.env`) | no code change; just ensure `.env` is correct at build time |

The `.env` file is the load-bearing one — Vite inlines these values at build time, so a fresh build picks them up. No source code changes needed for the Supabase client itself.

### Tier 2 — E2E tests (3 files)

| File | What's hardcoded | What to change |
|---|---|---|
| `tests/e2e/auth.setup.ts` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STORAGE_KEY = 'sb-ximxgnkpcswbvfrkkmjq-auth-token'` | All 3 — note the storage key changes to `sb-xmrhmxizpslhtkibqyfy-auth-token` |
| `tests/e2e/supabase-admin.ts` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Both |
| `tests/e2e/workflows/onboarding.spec.ts` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Both |

These are dev-only — won't affect production but tests will fail until updated. Recommendation: refactor to read from environment so they don't need code changes when project ref changes.

### Tier 3 — Config-only (already done in Phase 5)

| File | Status |
|---|---|
| `supabase/functions/seed-e2e-data/index.ts` (line 22) | ✅ already updated — destination ref added to `PRODUCTION_REFS` guard list |
| `supabase/functions/seed-demo-data/index.ts` (line 25) | ✅ already updated — same pattern |

These were Phase 5 prep work; no further changes.

---

## iOS-specific cutover items (Capacitor + Xcode)

### Capacitor config (`capacitor.config.ts`)

**No source ref hardcoded** — config is project-agnostic. The `appId` is `net.lessonloop.app` and the bundle is loaded from `webDir: 'dist'`, which is the Vite build output.

The commented-out `server.url` block (lines 9–13) is intentionally disabled (means "load bundled web app" mode). Don't uncomment it for production iOS — that turns the app into a thin webview pointing at app.lessonloop.net, which has different App Review implications than a bundled-asset app.

```ts
// LEAVE COMMENTED OUT for App Store builds:
// server: {
//   url: 'https://app.lessonloop.net',
//   cleartext: false,
// },
```

### iOS Xcode project — bundle ID inconsistency flagged

Three different bundle IDs floating around the codebase:

| Location | Value |
|---|---|
| `capacitor.config.ts` | `net.lessonloop.app` |
| `ios/App/App.xcodeproj/project.pbxproj` | `com.lessonloop.app` (×2) |
| (Apple Developer / App Store Connect) | unknown — check before changing anything |

These need reconciling, but it's **not a Supabase cutover concern**. Whatever bundle ID the App Store version uses, keep it consistent. Recommendation: don't change as part of this cutover — track separately.

### iOS Info.plist

No URL types or associated domains configured. This means:
- The OAuth deep-link callback flow in `signInWithOAuthNative` won't work natively on iOS as currently written.
- Either OAuth via the iOS app already uses a different mechanism (Lovable's wrapper handles it externally), OR Google Sign-In on iOS isn't actually working in production right now.
- Either way: **out of scope for this cutover**. Document the gap; if Google Sign-In on iOS is needed, that's a separate iOS work stream.

### Android intent filter (cross-cutting)

Already flagged in T6.3:
- `android/app/src/main/AndroidManifest.xml` has `<data android:scheme="https" android:host="app.lessonloop.com" />` — should be `.net`. Not a Supabase cutover blocker but should be fixed.

---

## Cutover-day file change summary (build into runbook T6.5)

```bash
# Production cutover — file changes (3 lines total in 2 files):

# 1. Update .env (the only live build-time variable)
sed -i \
  -e 's|VITE_SUPABASE_PROJECT_ID="ximxgnkpcswbvfrkkmjq"|VITE_SUPABASE_PROJECT_ID="xmrhmxizpslhtkibqyfy"|' \
  -e 's|VITE_SUPABASE_URL="https://ximxgnkpcswbvfrkkmjq.supabase.co"|VITE_SUPABASE_URL="https://xmrhmxizpslhtkibqyfy.supabase.co"|' \
  -e 's|VITE_SUPABASE_PUBLISHABLE_KEY="eyJ.*"|VITE_SUPABASE_PUBLISHABLE_KEY="<destination_publishable_key>"|' \
  .env

# 2. Update supabase/config.toml project_id
sed -i 's|^project_id = "ximxgnkpcswbvfrkkmjq"|project_id = "xmrhmxizpslhtkibqyfy"|' supabase/config.toml

# 3. Verify
grep -E "VITE_SUPABASE|project_id" .env supabase/config.toml
```

(Don't run sed in production blindly — runbook T6.5 has the verified-step version with rollback.)

---

## What does NOT need to change

- `src/integrations/supabase/client.ts` — reads from env vars, transparent to project ref
- `src/integrations/supabase/types.ts` — TypeScript types, not affected by project ref
- All edge function code — reads `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from runtime env injected by destination platform; these are the destination's values automatically
- `package.json`, `package-lock.json` — no Supabase URL hardcoded

---

## Capacitor build instructions for iOS cutover (Phase 7)

After the .env update + Vite build:

```bash
# 1. Build the web bundle with the new env values
npm run build

# 2. Sync the dist/ output into iOS native project
npx cap sync ios

# 3. Open in Xcode for archive + upload
npx cap open ios
```

Then in Xcode:
- Verify scheme is "App" + Release
- Select "Any iOS Device (arm64)"
- Product → Archive
- Distribute App → App Store Connect → Upload

The new build's bundled JavaScript will reference the destination Supabase URL.

> **Important:** users with the OLD app version will still hit source's URL until they update. Plan for an overlap period where source is kept reachable (read-only or full) until App Store rollout reaches sufficient adoption.

---

## Outstanding decisions for Phase 7

- [ ] When updating `.env`, do you want to commit the change to git, or treat it as a deploy-time-only swap?
- [ ] Is the App Store version actually using `com.lessonloop.app` (Xcode value) or `net.lessonloop.app` (Capacitor value)? Need to confirm before any iOS submission to avoid signing/provisioning failures.
- [ ] How long do you want to keep source reachable post-cutover (for in-flight iOS users on old app version)?
