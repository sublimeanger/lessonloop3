import { useEffect, useState } from 'react';
import { Network, ConnectionStatus } from '@capacitor/network';
import { platform } from '@/lib/platform';

/**
 * Enhanced network status hook that uses Capacitor's Network plugin
 * on native platforms for more reliable connectivity detection.
 * Falls back to navigator.onLine on web.
 */
export function useNativeNetwork() {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: true,
    connectionType: 'unknown',
  });

  useEffect(() => {
    if (!platform.isNative) {
      // Web fallback — use existing useOnlineStatus hook
      const update = () => setStatus({
        connected: navigator.onLine,
        connectionType: 'unknown',
      });
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      update();
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    // Native — use Capacitor Network plugin
    Network.getStatus().then(setStatus);
    const listener = Network.addListener('networkStatusChange', setStatus);
    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  return {
    isConnected: status.connected,
    connectionType: status.connectionType,
  };
}
