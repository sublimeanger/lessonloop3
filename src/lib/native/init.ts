import { SplashScreen } from '@capacitor/splash-screen';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { platform } from '../platform';
import { initStatusBar } from './statusBar';
import { initKeyboard } from './keyboard';
import { initDeepLinks } from './deepLinks';

/**
 * Initialise native app features. Call once in the root App.tsx on mount.
 * This runs setup that doesn't require auth (status bar, keyboard, etc.)
 */
export async function initNativeApp(navigate: (path: string) => void) {
  if (!platform.isNative) return;

  // Add body class for CSS scoping
  document.body.classList.add('capacitor');
  if (platform.isIOS) document.body.classList.add('capacitor-ios');
  if (platform.isAndroid) document.body.classList.add('capacitor-android');

  try {
    // Lock to portrait on phone
    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch {
    // May fail on iPad or unsupported devices
  }

  // Configure status bar (overlay mode + light style)
  await initStatusBar();

  // Setup keyboard handling
  initKeyboard();

  // Setup deep linking
  initDeepLinks(navigate);

  // Hide splash screen (after app is ready)
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {
    // Splash screen may already be hidden
  }
}
