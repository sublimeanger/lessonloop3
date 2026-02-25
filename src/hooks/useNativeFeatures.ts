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
    } catch { /* native API unavailable */ }
  }, []);

  /** Success haptic pattern — use after successful operations */
  const hapticSuccess = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.notification({ type: 'SUCCESS' as any });
    } catch { /* native API unavailable */ }
  }, []);

  /** Error haptic pattern */
  const hapticError = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.notification({ type: 'ERROR' as any });
    } catch { /* native API unavailable */ }
  }, []);

  /** Set status bar to dark content (for light backgrounds) */
  const setStatusBarLight = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await StatusBar.setStyle({ style: Style.Light });
    } catch { /* native API unavailable */ }
  }, []);

  /** Set status bar to light content (for dark backgrounds like the dashboard hero) */
  const setStatusBarDark = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await StatusBar.setStyle({ style: Style.Dark });
    } catch { /* native API unavailable */ }
  }, []);

  /** Hide keyboard programmatically */
  const hideKeyboard = useCallback(async () => {
    if (!platform.isNative) return;
    try {
      await Keyboard.hide();
    } catch { /* native API unavailable */ }
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
    } catch { /* native API unavailable */ }
  }, []);

  /** Open URL in native in-app browser */
  const openInAppBrowser = useCallback(async (url: string) => {
    if (!platform.isNative) {
      window.open(url, '_blank');
      return;
    }
    try {
      await Browser.open({ url, toolbarColor: '#0a1628' });
    } catch { /* native API unavailable */ }
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
