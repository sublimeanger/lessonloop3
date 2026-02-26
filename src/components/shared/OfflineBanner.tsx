import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { platform } from '@/lib/platform';

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] flex min-h-11 items-center justify-center gap-2 bg-warning/95 px-4 py-2 text-center text-body-strong text-warning-foreground"
      style={platform.isNative ? { paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' } : undefined}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4" />
      Offline — showing cached data
    </div>
  );
}
