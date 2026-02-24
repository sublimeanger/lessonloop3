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
