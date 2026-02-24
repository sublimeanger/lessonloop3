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
