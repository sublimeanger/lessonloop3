import { StatusBar, Style } from '@capacitor/status-bar';
import { platform } from '../platform';

export async function initStatusBar() {
  if (!platform.isNative) return;

  try {
    await StatusBar.setStyle({ style: Style.Light }); // dark text on light bg
    await StatusBar.setOverlaysWebView({ overlay: true }); // content goes under status bar
  } catch {
    // StatusBar API unavailable
  }
}

/** Call this when switching to dark mode or dark backgrounds */
export async function setDarkStatusBar() {
  if (!platform.isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark }); // light text on dark bg
  } catch {
    // StatusBar API unavailable
  }
}

/** Call this when switching back to light mode or light backgrounds */
export async function setLightStatusBar() {
  if (!platform.isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Light }); // dark text on light bg
  } catch {
    // StatusBar API unavailable
  }
}
