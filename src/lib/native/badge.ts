import { platform } from '../platform';

/** Update the app icon badge count */
export async function updateBadgeCount(count: number) {
  if (!platform.isNative) return;

  try {
    const { Badge } = await import('@capawesome/capacitor-badge');
    if (count > 0) {
      await Badge.set({ count });
    } else {
      await Badge.clear();
    }
  } catch {
    // Badge plugin unavailable
  }
}
