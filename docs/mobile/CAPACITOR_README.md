# LessonLoop — Capacitor Android Setup

This document covers the Capacitor Android configuration for LessonLoop.

## Quick Commands

| Command | Description |
|---|---|
| `npm run cap:build` | Build web app + sync to Android |
| `npm run cap:sync` | Sync web assets to Android (no rebuild) |
| `npm run cap:open` | Open project in Android Studio |
| `npm run cap:run` | Run on connected device or emulator |
| `npm run cap:icons` | Regenerate app icons from `public/favicon.svg` |

## Building the App

```bash
# Full build pipeline
npm run cap:build

# Or step by step:
npm run build          # Build web app to dist/
npx cap sync android   # Copy dist/ into Android project + update plugins
```

## Opening in Android Studio

```bash
npm run cap:open
```

Android Studio will prompt you to install any missing SDKs on first launch. Let it complete before running.

## Generating Icons

Icons are generated from `public/favicon.svg` using the sharp library:

```bash
npm run cap:icons
```

This produces:
- Launcher icons at all mipmap densities (mdpi through xxxhdpi)
- Adaptive icon foreground layers
- Notification icons at all drawable densities
- A 512x512 `play-store-icon.png` for the Google Play listing

## Testing on a Physical Device

1. Enable **Developer Options** on your Android phone (Settings > About Phone > tap Build Number 7 times)
2. Enable **USB Debugging** in Developer Options
3. Connect your phone via USB
4. Run `npm run cap:run` and select your device
5. Alternatively, open in Android Studio and click the green play button

## Testing on an Emulator

1. Open Android Studio: `npm run cap:open`
2. Go to **Tools > Device Manager**
3. Create a new virtual device (recommended: Pixel 6, API 33+)
4. Click the play button to launch on the emulator

## Creating a Signed Release APK / AAB

1. Open the project in Android Studio: `npm run cap:open`
2. Go to **Build > Generate Signed Bundle / APK**
3. Choose **Android App Bundle** (AAB) — Google Play prefers this over APK
4. Create a new keystore if you don't have one (Android Studio walks you through it)
5. Select **release** build variant
6. The signed AAB will be in `android/app/release/`

**Keep your keystore file safe and backed up.** You cannot update your app on Google Play without the same keystore.

## Adding a New Capacitor Plugin

```bash
# 1. Install the plugin
npm install @capacitor/example-plugin

# 2. Sync with Android
npx cap sync android

# 3. Import and use in your code
import { ExamplePlugin } from '@capacitor/example-plugin';
```

Always wrap plugin calls in platform checks using `src/lib/platform.ts`:

```typescript
import { platform } from '@/lib/platform';

if (platform.isNative) {
  // Call native plugin
}
```

## Installed Plugins

| Plugin | Purpose |
|---|---|
| `@capacitor/android` | Android platform support |
| `@capacitor/splash-screen` | Native splash screen on app launch |
| `@capacitor/status-bar` | Control status bar style and colour |
| `@capacitor/keyboard` | Keyboard events and control |
| `@capacitor/haptics` | Haptic feedback (vibration) |
| `@capacitor/app` | App lifecycle events, back button, deep links |
| `@capacitor/browser` | In-app browser for external URLs |
| `@capacitor/network` | Network status detection |
| `@capacitor/preferences` | Key-value storage (native) |
| `@capacitor/push-notifications` | Firebase Cloud Messaging (FCM) push notifications |
| `@capacitor/local-notifications` | Local device notifications |
| `@capacitor/share` | Native share sheet |
| `@capacitor/clipboard` | Clipboard read/write |

## Content Security Policy

The CSP in `index.html` includes Capacitor-specific origins:

- `capacitor://localhost` and `https://localhost` in `default-src`
- `capacitor://localhost` and `http://localhost` in `connect-src`
- `'unsafe-eval'` in `script-src` (required by Capacitor's bridge on Android)

If you add new external services, update the CSP accordingly.

## Push Notifications

Push notifications use Firebase Cloud Messaging (FCM) via `@capacitor/push-notifications`.

### Setup Required

1. **Create a Firebase project** at https://console.firebase.google.com
2. Add an Android app with package name `com.lessonloop.app`
3. Download `google-services.json` and place it in `android/app/`
4. The push notification service (`src/services/pushNotifications.ts`) saves tokens to a `push_tokens` table in Supabase

### Supabase Table Needed

Create a `push_tokens` table with these columns:

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK to auth.users |
| `org_id` | uuid | FK to organisations |
| `token` | text | FCM token |
| `platform` | text | 'android' or 'ios' |
| `updated_at` | timestamptz | Last updated |

Add a unique constraint on `(user_id, platform)`.

## Deep Links

The app handles two URL schemes:

- `https://app.lessonloop.com/*` — Universal links (requires `.well-known/assetlinks.json` on your domain)
- `lessonloop://*` — Custom scheme for app-to-app navigation

## Project Structure

```
android/
  app/
    src/main/
      assets/public/      # Built web app (synced from dist/)
      java/               # Android Java source
      res/
        drawable/          # Splash screen XML, notification icons
        mipmap-*/          # App launcher icons at all densities
        values/            # Colours, strings, styles
      AndroidManifest.xml  # App manifest with deep links
capacitor.config.ts        # Capacitor configuration
scripts/generate-icons.mjs # Icon generation script
src/
  lib/platform.ts          # Platform detection utility
  hooks/
    useNativeFeatures.ts   # Haptics, status bar, share, browser
    useNativeNetwork.ts    # Enhanced network detection
    useAndroidBackButton.ts # Android back button handler
  services/
    pushNotifications.ts   # Push notification service
```
