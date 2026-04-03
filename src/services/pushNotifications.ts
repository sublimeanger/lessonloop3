import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { platform } from '@/lib/platform';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Initialise push notifications for native platforms.
 * Call this once after user authentication.
 *
 * - Android: uses FCM (Firebase Cloud Messaging)
 * - iOS: uses APNs (Apple Push Notification service)
 *
 * The Capacitor PushNotifications plugin handles both transparently.
 */
export async function initPushNotifications(
  userId: string,
  orgId: string,
  navigate: (path: string) => void = (path) => { window.location.href = path; },
) {
  if (!platform.isNative) return;

  try {
    // Request permission
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      logger.info('Push notification permission denied');
      return;
    }

    // Register with the native push service (FCM for Android, APNs for iOS)
    await PushNotifications.register();

    // Listen for registration success — save the token to Supabase
    PushNotifications.addListener('registration', async (token: Token) => {
      logger.info(`Push registration success (${platform.getPlatform()})`);
      try {
        await supabase.from('push_tokens').upsert({
          user_id: userId,
          org_id: orgId,
          token: token.value,
          platform: platform.getPlatform(), // 'ios' or 'android'
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

      // Navigate based on notification type (uses React Router when available)
      if (data?.type === 'new_message' && data?.conversationId) {
        navigate(`/messages/${data.conversationId}`);
      } else if (data?.type === 'invoice_overdue' && data?.invoiceId) {
        navigate(`/invoices/${data.invoiceId}`);
      } else if (data?.type === 'lesson_reminder' && data?.lessonId) {
        navigate(`/calendar?lesson=${data.lessonId}`);
      } else if (data?.type === 'attendance_needed') {
        navigate('/register');
      } else if (data?.type === 'practice_reminder') {
        navigate('/portal/practice');
      } else if (data?.route) {
        // Fallback: navigate to a specific route if provided
        navigate(data.route);
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
