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
