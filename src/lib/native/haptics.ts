import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { platform } from '../platform';

export const haptics = {
  /** Light tap — button presses, selections */
  tap: async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch { /* unavailable */ }
  },

  /** Medium impact — swipe actions, confirmations */
  impact: async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch { /* unavailable */ }
  },

  /** Success — attendance marked, message sent, invoice paid */
  success: async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch { /* unavailable */ }
  },

  /** Warning — overdue invoice, expiring credit */
  warning: async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch { /* unavailable */ }
  },

  /** Error — validation failure, network error */
  error: async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch { /* unavailable */ }
  },

  /** Selection change — pickers, segment controls */
  selection: async () => {
    if (!platform.isNative) return;
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch { /* unavailable */ }
  },
};
