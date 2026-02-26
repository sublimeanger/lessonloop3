import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'net.lessonloop.app',
  appName: 'LessonLoop',
  webDir: 'dist',

  // Server config — use the web app URL in production
  // Comment this out for fully bundled/offline builds
  // server: {
  //   url: 'https://app.lessonloop.net',
  //   cleartext: false,
  // },

  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },

  android: {
    allowMixedContent: false,
    backgroundColor: '#0a1628',
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },

  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    backgroundColor: '#ffffff',
    allowsLinkPreview: false,
  },

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      launchFadeOutDuration: 300,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
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
