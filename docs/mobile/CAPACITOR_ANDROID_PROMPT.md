# LessonLoop — Android App Setup via Capacitor

## Prompt for Claude Code

> Copy this entire prompt into Claude Code in one go. It contains everything Claude Code needs to set up LessonLoop as an Android app using Capacitor.

---

```
I need you to set up Capacitor for Android in this project so we can publish LessonLoop to the Google Play Store. This is a Vite + React + TypeScript app with Supabase backend. Follow every step precisely. Do NOT skip any step. Explain what you're doing at each stage.

## Project Context
- App name: LessonLoop
- Bundle ID: com.lessonloop.app
- Build output: dist/ (Vite default)
- Vite config: vite.config.ts (already has VitePWA plugin)
- Supabase client: src/integrations/supabase/client.ts
- Env vars: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
- Brand colour (teal): #00c2b8
- Ink/dark colour: #0a1628
- Logo SVG: public/favicon.svg (48x48 viewBox, dark circle with teal+white loop and L mark)
- Existing PWA manifest: public/manifest.json
- CSP meta tag in index.html needs updating for Capacitor

## Step 1 — Install Capacitor Core + CLI + Android

Run:
```bash
npm install @capacitor/core
npm install -D @capacitor/cli
```

Then initialise Capacitor:
```bash
npx cap init "LessonLoop" "com.lessonloop.app" --web-dir dist
```

This should create `capacitor.config.ts` in the project root.

## Step 2 — Configure capacitor.config.ts

Replace the generated config with a properly configured version:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lessonloop.app',
  appName: 'LessonLoop',
  webDir: 'dist',
  
  // Server config — use the web app URL in production
  // Comment this out for fully bundled/offline builds
  // server: {
  //   url: 'https://app.lessonloop.com',
  //   cleartext: false,
  // },

  android: {
    // Allow mixed content for development
    allowMixedContent: false,
    // Splash screen background
    backgroundColor: '#0a1628',
    // Build options
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#0a1628',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a1628',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notification',
      iconColor: '#00c2b8',
    },
  },
};

export default config;
```

## Step 3 — Install Capacitor Plugins

Install all the plugins LessonLoop needs:

```bash
# Core native features
npm install @capacitor/android
npm install @capacitor/splash-screen
npm install @capacitor/status-bar
npm install @capacitor/keyboard
npm install @capacitor/haptics
npm install @capacitor/app
npm install @capacitor/browser
npm install @capacitor/network
npm install @capacitor/preferences

# Push notifications
npm install @capacitor/push-notifications
npm install @capacitor/local-notifications

# Share & clipboard (for sharing resources, copying invite links)
npm install @capacitor/share
npm install @capacitor/clipboard
```

## Step 4 — Add Android Platform

```bash
npx cap add android
```

This creates the `android/` directory with a full Android Studio project.

## Step 5 — Update Content Security Policy

The existing CSP in `index.html` blocks Capacitor's bridge. Update the meta tag to include Capacitor origins.

In `index.html`, find the Content-Security-Policy meta tag and update the `connect-src` directive to add:
- `capacitor://localhost`
- `http://localhost`

Also update `default-src` to include:
- `capacitor://localhost`
- `https://localhost`

And update `script-src` to include:
- `'unsafe-eval'` (required by Capacitor's bridge on Android)

**Important:** Only add the minimum necessary. Keep all existing CSP directives intact.

## Step 6 — Create Platform Detection Utility

Create `src/lib/platform.ts`:

```typescript
import { Capacitor } from '@capacitor/core';

/**
 * Platform detection utilities for LessonLoop.
 * Use these to conditionally enable native features.
 */
export const platform = {
  /** True when running inside a native Capacitor shell */
  isNative: Capacitor.isNativePlatform(),
  
  /** True when running on Android */
  isAndroid: Capacitor.getPlatform() === 'android',
  
  /** True when running on iOS */
  isIOS: Capacitor.getPlatform() === 'ios',
  
  /** True when running in the web browser */
  isWeb: Capacitor.getPlatform() === 'web',
  
  /** Get the current platform string */
  getPlatform: () => Capacitor.getPlatform(),
};
```

## Step 7 — Create Native Utilities Hook

Create `src/hooks/useNativeFeatures.ts`:

```typescript
import { useCallback } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { platform } from '@/lib/platform';

/**
 * Hook providing access to native device features.
 * All methods are safe to call on web — they silently no-op when not native.
 */
export function useNativeFeatures() {
  /** Light haptic tap — use on button presses, toggles, confirmations */
  const hapticTap = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Silently fail — haptics are optional
    }
  }, []);

  /** Medium haptic — use on important actions like saving, deleting */
  const hapticMedium = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  }, []);

  /** Success haptic pattern — use after successful operations */
  const hapticSuccess = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.notification({ type: 'SUCCESS' as any });
    } catch {}
  }, []);

  /** Error haptic pattern */
  const hapticError = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.notification({ type: 'ERROR' as any });
    } catch {}
  }, []);

  /** Set status bar to dark content (for light backgrounds) */
  const setStatusBarLight = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await StatusBar.setStyle({ style: Style.Light });
    } catch {}
  }, []);

  /** Set status bar to light content (for dark backgrounds like the dashboard hero) */
  const setStatusBarDark = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await StatusBar.setStyle({ style: Style.Dark });
    } catch {}
  }, []);

  /** Hide keyboard programmatically */
  const hideKeyboard = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await Keyboard.hide();
    } catch {}
  }, []);

  /** Share content via native share sheet */
  const shareContent = useCallback(async (options: { title?: string; text?: string; url?: string }) => {
    if (!platform.isNative) {
      // Fallback to clipboard on web
      if (options.url) {
        await navigator.clipboard.writeText(options.url);
      }
      return;
    }
    try {
      await Share.share(options);
    } catch {}
  }, []);

  /** Open URL in native in-app browser */
  const openInAppBrowser = useCallback(async (url: string) => {
    if (!platform.isNative) {
      window.open(url, '_blank');
      return;
    }
    try {
      await Browser.open({ url, toolbarColor: '#0a1628' });
    } catch {}
  }, []);

  return {
    hapticTap,
    hapticMedium,
    hapticSuccess,
    hapticError,
    setStatusBarLight,
    setStatusBarDark,
    hideKeyboard,
    shareContent,
    openInAppBrowser,
    isNative: platform.isNative,
    isAndroid: platform.isAndroid,
  };
}
```

## Step 8 — Create Push Notification Service

Create `src/services/pushNotifications.ts`:

```typescript
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { platform } from '@/lib/platform';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Initialise push notifications for native platforms.
 * Call this once after user authentication.
 */
export async function initPushNotifications(userId: string, orgId: string) {
  if (!platform.isNative) return;

  try {
    // Request permission
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      logger.info('Push notification permission denied');
      return;
    }

    // Register with the native push service (FCM for Android)
    await PushNotifications.register();

    // Listen for registration success — save the token to Supabase
    PushNotifications.addListener('registration', async (token: Token) => {
      logger.info('Push registration success');
      try {
        await supabase.from('push_tokens').upsert({
          user_id: userId,
          org_id: orgId,
          token: token.value,
          platform: platform.getPlatform(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform',
        });
      } catch (err) {
        logger.error('Failed to save push token:', err);
      }
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      logger.error('Push registration error:', error);
    });

    // Listen for incoming notifications while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      logger.info('Push notification received:', notification);
      // Show as local notification since the app is in foreground
      LocalNotifications.schedule({
        notifications: [{
          title: notification.title || 'LessonLoop',
          body: notification.body || '',
          id: Date.now(),
          extra: notification.data,
        }],
      });
    });

    // Listen for notification taps (user opened the app via notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      logger.info('Push notification action:', action);
      const data = action.notification.data;
      // Navigate based on notification type
      if (data?.route) {
        window.location.href = data.route;
      }
    });

  } catch (err) {
    logger.error('Failed to initialise push notifications:', err);
  }
}

/**
 * Remove push notification listeners and unregister.
 * Call on sign-out.
 */
export async function teardownPushNotifications() {
  if (!platform.isNative) return;
  try {
    await PushNotifications.removeAllListeners();
  } catch (err) {
    logger.error('Failed to teardown push notifications:', err);
  }
}
```

**Note:** This references a `push_tokens` table in Supabase that you'll need to create later. For now the code is ready — the table creation is a backend task. The service will silently fail without the table, which is fine during development.

## Step 9 — Create Network Status Hook (enhanced for native)

Create `src/hooks/useNativeNetwork.ts`:

```typescript
import { useEffect, useState } from 'react';
import { Network, ConnectionStatus } from '@capacitor/network';
import { platform } from '@/lib/platform';

/**
 * Enhanced network status hook that uses Capacitor's Network plugin
 * on native platforms for more reliable connectivity detection.
 * Falls back to navigator.onLine on web.
 */
export function useNativeNetwork() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: true,
    connectionType: 'unknown',
  });

  useEffect(() => {
    if (!platform.isNative) {
      // Web fallback — use existing useOnlineStatus hook
      const update = () => setStatus({
        connected: navigator.onLine,
        connectionType: 'unknown',
      });
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      update();
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    // Native — use Capacitor Network plugin
    Network.getStatus().then(setStatus);
    const listener = Network.addListener('networkStatusChange', setStatus);
    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  return {
    isConnected: status.connected,
    connectionType: status.connectionType,
  };
}
```

## Step 10 — Handle Android Back Button

Create `src/hooks/useAndroidBackButton.ts`:

```typescript
import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { platform } from '@/lib/platform';

/**
 * Handle Android hardware back button.
 * - On root pages (dashboard, portal home): minimise the app
 * - On other pages: navigate back in history
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!platform.isAndroid) return;

    const rootPaths = ['/dashboard', '/portal/home', '/login'];
    
    const listener = App.addListener('backButton', ({ canGoBack }) => {
      const isRootPage = rootPaths.includes(location.pathname);
      
      if (isRootPage) {
        // Minimise app on root pages instead of exiting
        App.minimizeApp();
      } else if (canGoBack) {
        navigate(-1);
      } else {
        App.minimizeApp();
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate, location.pathname]);
}
```

## Step 11 — Integrate into App Entry Point

Now wire everything into the app. 

In `src/App.tsx` (or wherever the root component is), add the Android back button handler. Find the main App component and add inside it:

```typescript
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';

// Inside the component:
useAndroidBackButton();
```

In the auth context (or wherever you handle successful login), call push notification init:

```typescript
import { initPushNotifications, teardownPushNotifications } from '@/services/pushNotifications';

// After successful auth:
if (user && currentOrg) {
  initPushNotifications(user.id, currentOrg.id);
}

// On sign-out:
await teardownPushNotifications();
```

**Important:** Don't modify the auth flow aggressively. Just add the push notification calls at the right points. If it's not obvious where to put them, tell me and we'll figure it out together.

## Step 12 — Generate App Icons

The Android project needs icons at multiple sizes. Use the existing `public/favicon.svg` as the source.

Install sharp for image generation:
```bash
npm install -D sharp
```

Create a script `scripts/generate-icons.mjs`:

```javascript
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SVG_PATH = 'public/favicon.svg';
const ANDROID_RES = 'android/app/src/main/res';

// Android adaptive icon sizes
const sizes = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

// Notification icon sizes (monochrome white)
const notifSizes = [
  { name: 'drawable-mdpi', size: 24 },
  { name: 'drawable-hdpi', size: 36 },
  { name: 'drawable-xhdpi', size: 48 },
  { name: 'drawable-xxhdpi', size: 72 },
  { name: 'drawable-xxxhdpi', size: 96 },
];

// Play Store icon
const PLAY_STORE_SIZE = 512;

async function generate() {
  console.log('Generating Android icons from', SVG_PATH);

  // App launcher icons
  for (const { name, size } of sizes) {
    const dir = join(ANDROID_RES, name);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    
    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_launcher.png'));
    
    // Round variant
    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_launcher_round.png'));

    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  // Foreground layer for adaptive icons (108dp with 18dp safe zone = actual icon is 66dp centered in 108dp)
  const adaptiveSizes = [
    { name: 'mipmap-mdpi', size: 108 },
    { name: 'mipmap-hdpi', size: 162 },
    { name: 'mipmap-xhdpi', size: 216 },
    { name: 'mipmap-xxhdpi', size: 324 },
    { name: 'mipmap-xxxhdpi', size: 432 },
  ];

  for (const { name, size } of adaptiveSizes) {
    const dir = join(ANDROID_RES, name);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Create foreground with padding for adaptive icon safe zone
    const iconSize = Math.round(size * 0.6); // Icon is ~60% of the canvas
    const padding = Math.round((size - iconSize) / 2);

    await sharp(SVG_PATH)
      .resize(iconSize, iconSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .resize(size, size) // Ensure exact size after extend rounding
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));

    console.log(`  ✓ ${name} adaptive foreground (${size}x${size})`);
  }

  // Notification icons (should be simple, single-colour silhouette)
  // Using a simplified white version — you may want to create a dedicated notification SVG
  for (const { name, size } of notifSizes) {
    const dir = join(ANDROID_RES, name);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_stat_notification.png'));

    console.log(`  ✓ ${name} notification (${size}x${size})`);
  }

  // Play Store listing icon (512x512)
  await sharp(SVG_PATH)
    .resize(PLAY_STORE_SIZE, PLAY_STORE_SIZE)
    .png()
    .toFile('play-store-icon.png');
  
  console.log(`  ✓ Play Store icon (${PLAY_STORE_SIZE}x${PLAY_STORE_SIZE})`);

  console.log('\n✅ All icons generated successfully!');
}

generate().catch(console.error);
```

Run it:
```bash
node scripts/generate-icons.mjs
```

## Step 13 — Create Splash Screen

Create `android/app/src/main/res/drawable/splash.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background" />
    <item
        android:width="96dp"
        android:height="96dp"
        android:gravity="center"
        android:drawable="@mipmap/ic_launcher" />
</layer-list>
```

Create `android/app/src/main/res/values/colors.xml` (or update if it exists):
Add this colour value:
```xml
<color name="splash_background">#0a1628</color>
```

## Step 14 — Configure Android Styles for Edge-to-Edge

Update `android/app/src/main/res/values/styles.xml` to include:
```xml
<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="windowNoTitle">true</item>
    <item name="windowActionBar">false</item>
    <item name="android:background">@null</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
</style>
```

## Step 15 — Add Android-Specific Deep Link Config

Update `android/app/src/main/AndroidManifest.xml` to add deep link support for LessonLoop URLs:

Inside the main `<activity>` tag, add an intent filter:
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="app.lessonloop.com" />
</intent-filter>
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="lessonloop" />
</intent-filter>
```

Also ensure the internet permission is present:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## Step 16 — Add npm Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "cap:sync": "cap sync android",
    "cap:open": "cap open android",
    "cap:build": "npm run build && cap sync android",
    "cap:run": "cap run android",
    "cap:icons": "node scripts/generate-icons.mjs"
  }
}
```

## Step 17 — Update .gitignore

Add to `.gitignore`:
```
# Capacitor
android/app/build/
android/.gradle/
android/build/
android/local.properties

# Generated icons
play-store-icon.png
```

**Do NOT ignore the entire `android/` directory** — it needs to be in version control.

## Step 18 — Build, Sync, and Verify

Run the full pipeline:

```bash
# Build the web app
npm run build

# Sync with Android
npx cap sync android
```

Then verify:
- `android/` directory exists with proper structure
- `android/app/src/main/assets/public/` contains the built web app files
- `capacitor.config.ts` is properly configured
- All icons generated in the correct mipmap folders
- No TypeScript errors: `npm run typecheck`
- No build errors: `npm run build`

## Step 19 — Create a CAPACITOR_README.md

Create a `CAPACITOR_README.md` in the project root documenting:
1. How to build: `npm run cap:build`
2. How to open in Android Studio: `npm run cap:open`
3. How to generate icons: `npm run cap:icons`
4. How to add a new Capacitor plugin
5. How to test on a physical device
6. How to create a signed release APK for Play Store
7. List of installed plugins and what they're for
8. Reminder that CSP in index.html needs Capacitor origins
9. Note about the push_tokens Supabase table needed for push notifications

## Summary of Files Created/Modified

**New files:**
- `capacitor.config.ts` — Capacitor configuration
- `src/lib/platform.ts` — Platform detection utility
- `src/hooks/useNativeFeatures.ts` — Native features hook (haptics, status bar, share, browser)
- `src/hooks/useNativeNetwork.ts` — Enhanced network detection
- `src/hooks/useAndroidBackButton.ts` — Android back button handler
- `src/services/pushNotifications.ts` — Push notification service
- `scripts/generate-icons.mjs` — Icon generation script
- `android/` — Full Android project (generated by Capacitor)
- `CAPACITOR_README.md` — Documentation
- `play-store-icon.png` — 512x512 Play Store icon

**Modified files:**
- `package.json` — New dependencies + scripts
- `index.html` — Updated CSP for Capacitor
- `src/App.tsx` — Added useAndroidBackButton hook
- `.gitignore` — Android build artifacts
- `android/app/src/main/res/values/colors.xml` — Splash background colour
- `android/app/src/main/res/drawable/splash.xml` — Splash screen layout
- `android/app/src/main/AndroidManifest.xml` — Deep links + permissions

After you finish, tell me:
1. Any errors you encountered and how you resolved them
2. The full list of files created and modified
3. Confirmation that `npm run build` passes
4. Confirmation that `npx cap sync android` completed successfully
5. Any TODO items I need to handle manually (like opening Android Studio)
```

---

## What You Do After Claude Code Finishes

1. **Install Android Studio** if you haven't: https://developer.android.com/studio
2. Run `npm run cap:open` to open the project in Android Studio
3. Let Android Studio download/install any required SDKs (it'll prompt you)
4. Click the green play button to run on an emulator or connected phone
5. Test the app thoroughly — navigation, auth, all pages
6. When ready to publish:
   - In Android Studio: Build → Generate Signed Bundle / APK
   - Create a keystore (Android Studio walks you through it)
   - Build a signed AAB (Android App Bundle) — Google Play prefers this over APK
   - Go to https://play.google.com/console and create your app listing
   - Upload the AAB, fill in the store listing, and submit for review

## Google Play Store Checklist (you'll need these)

- [ ] Google Play Developer account ($25 one-time) — https://play.google.com/console/signup
- [ ] Play Store icon (512x512) — generated by the script as `play-store-icon.png`
- [ ] Feature graphic (1024x500) — create in Canva or similar
- [ ] Phone screenshots (min 2, recommended 4-8) — take from emulator at 1080x1920
- [ ] Short description (80 chars max)
- [ ] Full description (4000 chars max)
- [ ] Privacy policy URL (required) — host on your website
- [ ] App category: Education
- [ ] Content rating questionnaire (in Play Console)
- [ ] Target audience declaration (not primarily for children)
- [ ] Data safety form (in Play Console — declare what data you collect)
