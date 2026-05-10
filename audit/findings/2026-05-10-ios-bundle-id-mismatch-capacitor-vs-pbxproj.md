# iOS bundle ID mismatch — capacitor.config.ts vs Xcode pbxproj

**Severity:** medium
**Status:** open (Jamie verification required before s25 entitlements ship)
**Area:** mobile / iOS
**Discovered:** 2026-05-10 (s25)
**Fixed:** —
**Fixed in:** —
**Affected components:** capacitor.config.ts, ios/App/App.xcodeproj/project.pbxproj

## Symptom

`capacitor.config.ts` declares `appId: 'net.lessonloop.app'`, but `ios/App/App.xcodeproj/project.pbxproj` declares `PRODUCT_BUNDLE_IDENTIFIER = com.lessonloop.app` for both Debug and Release configurations (lines 308, 329).

These are inconsistent. The bundle ID in the App Store is whichever Xcode used at archive time — that's `com.lessonloop.app` per the pbxproj.

## Root cause

Two possibilities:
1. `capacitor.config.ts` was updated to `net.lessonloop.app` at some point but `npx cap sync ios` was not re-run, OR `cap sync` doesn't touch pbxproj (it doesn't — `cap sync` only updates the bridging layer, not Xcode project metadata).
2. The shipped App Store build uses `com.lessonloop.app`. Any change to `net.lessonloop.app` would create a NEW App Store entry rather than update the existing app.

Per shipped state being source-of-truth (HANDOVER says "v1.2 in App Store review"), the App Store entry is `com.lessonloop.app`.

## Action required (Jamie)

Decision: keep `com.lessonloop.app` (live ID) or migrate to `net.lessonloop.app` (NEW app entry).

Recommend KEEP `com.lessonloop.app`. Migrating to a new bundle ID would:
- Force every existing user to manually re-install
- Require a new App Store listing (lose reviews, ratings)
- Break iCloud / KeyChain entries

Fix:
1. Update `capacitor.config.ts`: `appId: 'com.lessonloop.app'`
2. Run `npx cap sync ios`
3. Verify `PRODUCT_BUNDLE_IDENTIFIER` still matches in pbxproj (should not change)
4. Update apple-app-site-association `appID` to use the team-id-prefixed form: `<TEAMID>.com.lessonloop.app`

## s25 entitlements work

The App.entitlements file added in s25 is bundle-id-agnostic — `aps-environment` and `com.apple.developer.associated-domains` work for any bundle ID.

The apple-app-site-association JSON requires the team-id-prefixed bundle ID — the s25 deploy uses placeholder `TEAMID.com.lessonloop.app` (not `net.lessonloop.app`) for safety, since pbxproj is the build-time source of truth.

## Verification

After Jamie confirms bundle ID, re-verify:
- `capacitor.config.ts` matches `PRODUCT_BUNDLE_IDENTIFIER`
- apple-app-site-association `appID` field has correct team-id prefix
- Universal Link tap from email opens app (not Safari) on TestFlight build

## Lessons / follow-ups

When wrapping a Capacitor project for iOS submission, treat `pbxproj` as the deployed-truth source. `capacitor.config.ts` is a build-time hint, not the binding contract that ships.
