import { useSearchParams } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Returns a function that appends the current `?child=` param to any portal path.
 * Use this for all portal internal links so the child filter persists across navigation.
 */
export function usePortalLink() {
  const [searchParams] = useSearchParams();

  const portalLink = useCallback(
    (path: string): string => {
      const childId = searchParams.get('child');
      if (!childId) return path;
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}child=${encodeURIComponent(childId)}`;
    },
    [searchParams],
  );

  return { portalLink };
}

/**
 * Build a portal path with a child param (static, no hook).
 */
export function buildPortalLink(path: string, childId: string | null): string {
  if (!childId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}child=${encodeURIComponent(childId)}`;
}
