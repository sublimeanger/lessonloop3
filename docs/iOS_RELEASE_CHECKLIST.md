# iOS Release Checklist (next App Store submission)

**Last updated:** 2026-05-10 (s25)
**Owner:** Jamie McKaye

This checklist covers the next iOS App Store submission after the s25 hardening work. The agent half is shipped in `main`; this document tracks what Jamie does in Xcode + App Store Connect.

---

## What s25 shipped (agent half)

- `ios/App/App/Info.plist`:
  - Added `NSCameraUsageDescription` (Camera plugin currently calls `Camera.getPhoto()` at runtime — would crash without this)
  - Added `NSPhotoLibraryUsageDescription`
  - Added `NSPhotoLibraryAddUsageDescription`
  - Added `CFBundleURLTypes` with `lessonloop://` custom scheme
  - Added `UIBackgroundModes` array with `remote-notification`
- `ios/App/App/App.entitlements` (NEW file):
  - `aps-environment` = `production`
  - `com.apple.developer.associated-domains` = `applinks:app.lessonloop.net`, `applinks:lessonloop.net`
- `ios/App/App.xcodeproj/project.pbxproj`:
  - Added `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` to Debug + Release build configurations
- `public/.well-known/apple-app-site-association` (NEW file):
  - JSON declaring Universal Link paths: `/auth/callback*`, `/accept-invite*`, `/respond/*`, `/portal/*`
  - Uses placeholder `TEAMID.com.lessonloop.app` — Jamie must replace TEAMID with the Apple Developer Team ID
- `public/_headers` (NEW file):
  - Sets `Content-Type: application/json` for `/.well-known/apple-app-site-association` (Apple's CDN rejects any other Content-Type)
- `src/lib/native/deepLinks.ts`: exported `isAllowedDeepLink` for unit testing
- `src/test/native/deepLinks.test.ts` (NEW): 8 unit tests covering path-traversal protection + allowlist contract

---

## ⚠️ Open issues Jamie must resolve before archive

### 1. Bundle ID mismatch (medium severity)

`capacitor.config.ts` says `appId: 'net.lessonloop.app'`. Xcode `pbxproj` says `PRODUCT_BUNDLE_IDENTIFIER = com.lessonloop.app`. The shipped App Store entry is whatever Xcode used at archive time — that's `com.lessonloop.app`.

**Action:** decide on the canonical ID. Recommend keeping `com.lessonloop.app` (don't lose App Store reviews / re-install all users).

If keeping `com.lessonloop.app`:
1. Update `capacitor.config.ts`: `appId: 'com.lessonloop.app'`
2. Run `npx cap sync ios`
3. Verify `PRODUCT_BUNDLE_IDENTIFIER` in pbxproj is unchanged

If migrating to `net.lessonloop.app`: this requires a new App Store entry. Plan a migration prompt for existing users.

See `audit/findings/2026-05-10-ios-bundle-id-mismatch-capacitor-vs-pbxproj.md`.

### 2. apple-app-site-association TEAMID placeholder

The file `public/.well-known/apple-app-site-association` uses `TEAMID.com.lessonloop.app` as the appID. Replace `TEAMID` with the actual Apple Developer Team ID (a 10-char string like `ABCD1234EF`).

**To find the Team ID:**
- Apple Developer portal → Membership tab → Team ID
- OR Xcode → Settings → Accounts → select team → above team name

After replacing, deploy via `git push` (Netlify auto-deploys).

### 3. Add App.entitlements to Xcode project navigator

The `CODE_SIGN_ENTITLEMENTS` build setting points to `App/App.entitlements` and code-signing will find it. But the file isn't currently registered in the project navigator (no `PBXFileReference`).

**Optional but tidy:** in Xcode, right-click the `App` group in the navigator → "Add Files to App…" → select `App/App.entitlements`. Don't tick "Copy items if needed" (file is already in place); tick the App target.

### 4. Enable capabilities in Xcode

In Xcode:
- Select the App target → Signing & Capabilities tab
- Click "+ Capability" → add **Push Notifications**
- Click "+ Capability" → add **Associated Domains**
- The Associated Domains capability may auto-populate from `App.entitlements` — verify both `applinks:app.lessonloop.net` and `applinks:lessonloop.net` are present

If a capability fails to add ("requires App Store Connect provisioning profile update"): visit Apple Developer portal → Certificates, IDs & Profiles → select the `com.lessonloop.app` App ID → enable Push Notifications + Associated Domains there first, then return to Xcode and re-try.

---

## Build + archive

```bash
cd /tmp/lessonloop3-deploy

# 1. Web build
npm run build
# Verify dist/ has the new public/.well-known/apple-app-site-association

# 2. Sync iOS
npx cap sync ios
# This copies dist/ into the iOS app's bundled web assets

# 3. Open Xcode
npx cap open ios
# (or: open ios/App/App.xcworkspace)
```

In Xcode:
- Increment `MARKETING_VERSION` (currently `1.0` in pbxproj — but App Store says `v1.2`, so the pbxproj is stale; check what App Store Connect shows and bump to next minor — e.g. `1.3`)
- Increment `CURRENT_PROJECT_VERSION` (the build number — App Store rejects duplicates)
- Product → Clean Build Folder
- Product → Archive

---

## TestFlight verification (before App Store submit)

After archive uploads to App Store Connect → TestFlight builds:

- [ ] Login flow works
- [ ] Camera prompt appears on first photo upload (e.g. /students → upload profile photo)
- [ ] Photo library prompt appears on first resource pick
- [ ] Push notification prompt appears on first launch (if `initPushNotifications` is called post-auth)
- [ ] Universal Link from email opens the app, not Safari:
  - [ ] tap a `/auth/callback?token=…` link from an email → app opens, not Safari
  - [ ] tap an `/accept-invite?token=…` link → app opens
  - [ ] tap a `/respond/continuation?token=…` link → app opens
- [ ] Custom scheme works: `lessonloop://anything` opens the app
- [ ] OAuth in-app browser closes correctly after callback
- [ ] No crashes in 5 minutes of normal use

If any TestFlight check fails: do not submit to App Store. Diagnose; fix; re-archive.

---

## Apple Privacy & Nutrition labels

App Store Connect → My App → App Privacy → update for new data collection:

- **Data Linked to You** (this is everything you collect tied to a user account):
  - Email address (signup, contact)
  - Name (parent + student)
  - Phone number (optional, contact)
  - User content (lesson notes, messages, practice logs)
  - Identifiers (user ID)
  - Diagnostics (Sentry crash reports — note: aggregated, not linked)
  - Usage data (analytics — only if cookie consent granted)
- **Data Used to Track You**: none
- **Data Not Collected**: location, browsing history, contacts, search history, sensitive info, financial info (Stripe handles all card data — they're a sub-processor, not us)

Mention sub-processors in App Privacy details:
- Anthropic (LoopAssist AI queries)
- Stripe (payment processing)
- Resend (transactional email)
- Sentry (error reporting, opted-in)

---

## App Store submission

App Store Connect → App Versions → "+ Version":

- Version: matches the new `MARKETING_VERSION` from Xcode
- Build: select the latest TestFlight-verified build
- What's New in This Version:
  ```
  - Push notifications for new messages, lesson reminders, and overdue invoices
  - Universal Link support — tap email links to open the app directly
  - Camera-based profile photo upload
  - Bug fixes and stability improvements
  ```
- Screenshots: refresh if any UI flows changed since v1.2 (latest was 2026-04-XX; check App Store Connect)
- App Review Information:
  - Test account: provide one of the e2e accounts OR create a dedicated reviewer account
  - Notes: "App requires sign-in. Test credentials: <reviewer-email>/<password>. Optional: parent role at <parent-email>/<password>."
- Submit for Review

---

## Post-submission monitoring

- Watch App Store Connect notifications for review status
- If rejected: read the rejection reason carefully; most common = missing usage descriptions (already fixed in s25), permission abuse (push prompted without context), or deep-link path-traversal (s25 unit tests prove the protection)
- Once approved + released: verify cold-launch on a fresh device pull (delete app, reinstall from App Store, walk the smoke flow)

---

## What's NOT in s25

- Android (`AndroidManifest.xml` has wrong domain `app.lessonloop.com` instead of `.net` — see findings; defer to dedicated mobile-android audit run since Android isn't yet live)
- Push notification end-to-end test on physical device (requires APNs cert + actual device)
- Real Universal Link test from a TestFlight build (requires a TestFlight build to test)

These are explicitly Jamie's responsibility post-archive.
