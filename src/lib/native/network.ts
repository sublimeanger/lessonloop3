import { Network } from '@capacitor/network';
import { platform } from '../platform';

export function initNetworkListener(
  onOnline: () => void,
  onOffline: () => void,
) {
  if (!platform.isNative) {
    // Web fallback — handled by useOnlineStatus hook
    return;
  }

  Network.addListener('networkStatusChange', (status) => {
    if (status.connected) {
      onOnline();
    } else {
      onOffline();
    }
  });
}
