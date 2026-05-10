# iOS bundle ID mismatch — capacitor.config.ts vs Xcode pbxproj

**Severity:** medium
**Status:** fixed (kept com.lessonloop.app per shipped App Store ID)
**Area:** mobile / iOS
**Discovered:** 2026-05-10 (s25)
**Fixed:** 2026-05-10 (s26)
**Fixed in:** capacitor.config.ts edit in s26
**Affected components:** capacitor.config.ts, ios/App/App.xcodeproj/project.pbxproj

## Symptom

`capacitor.config.ts` declares `appId: 'net.lessonloop.app'`, but `ios/App/App.xcodeproj/project.pbxproj` declares `PRODUCT_BUNDLE_IDENTIFIER = com.lessonloop.app` for both Debug and Release configurations (lines 308, 329).

These are inconsistent. The bundle ID in the App Store is whichever Xcode used at archive time — that's `com.lessonloop.app` per the pbxproj.

## Root cause

Two possibilities:
1. `capacitor.config.ts` was updated to `net.lessonloop.app` at some point but `npx cap sync ios` was not re-run, OR `cap sync` doesn't touch pbxproj (it doesn't — `cap sync` only updates the bridging layer, not Xcode project metadata).
2. The shipped App Store build uses `com.lessonloop.app`. Any change to `net.lessonloop.app` would create a NEW App Store entry rather than update the existing app.

Per shipped state being source-of-truth (HANDOVER says "v1.2 in App Store review"), the App Store entry is `com.lessonloop.app`.

## Resolution (s26)

Agent applied the recommended fix: kept `com.lessonloop.app` (the live App Store ID per pbxproj) and aligned `capacitor.config.ts` to match.

Migration to `net.lessonloop.app` would have forced every existing user to manually re-install (App Store treats it as a new app), broken iCloud / KeyChain entries, and lost the existing App Store listing's reviews + ratings. None of those costs are worth a cosmetic ID change.

Changes shipped:
1. `capacitor.config.ts` `appId: 'net.lessonloop.app'` → `'com.lessonloop.app'` (1-line edit + comment block).
2. `ios/App/App.xcodeproj/project.pbxproj` `PRODUCT_BUNDLE_IDENTIFIER = com.lessonloop.app` — unchanged (already correct).
3. `public/.well-known/apple-app-site-association` `appID: TEAMID.com.lessonloop.app` — unchanged (s25 already used `com.` prefix correctly).

Jamie's remaining step: replace the literal string `TEAMID` in `public/.well-known/apple-app-site-association` with the actual Apple Developer Team ID before the next App Store submission. See docs/iOS_RELEASE_CHECKLIST.md for instructions.

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
