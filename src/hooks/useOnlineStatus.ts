import { useState, useEffect, useSyncExternalStore, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

/**
 * Reactive online/offline status hook.
 * - Invalidates all queries when coming back online.
 * - Provides `guardOffline()` helper for mutation guards.
 */
export function useOnlineStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, () => true);
  const queryClient = useQueryClient();

  // On reconnect → invalidate all queries to refresh stale data
  useEffect(() => {
    if (isOnline) {
      // Small delay to let network stabilise before refetching
      const timer = setTimeout(() => {
        queryClient.invalidateQueries();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, queryClient]);

  /**
   * Call before executing a mutation.
   * Returns `true` if offline (mutation should be blocked),
   * and shows a toast explaining why.
   */
  const guardOffline = useCallback((): boolean => {
    if (!navigator.onLine) {
      toast({
        title: "You're offline",
        description: 'This action will be available when you reconnect.',
        variant: 'destructive',
      });
      return true;
    }
    return false;
  }, []);

  return { isOnline, guardOffline };
}
