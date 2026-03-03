import { App as CapApp } from '@capacitor/app';
import { platform } from '../platform';
import { allRoutes } from '@/config/routes';

/** Pre-compute the set of known top-level path prefixes from the route table */
const knownPaths = allRoutes.map(r => r.path.split('/').slice(0, 2).join('/'));

/** Returns true if the path is safe to navigate to */
function isAllowedDeepLink(path: string): boolean {
  // Block path traversal and dangerous URI schemes
  if (path.includes('..') || path.startsWith('javascript:') || path.startsWith('data:')) {
    return false;
  }

  const pathBase = '/' + path.split('/').filter(Boolean).slice(0, 1).join('/');
  return knownPaths.some(kp => kp === pathBase || kp.startsWith(pathBase + '/'));
}

export function initDeepLinks(navigate: (path: string) => void) {
  if (!platform.isNative) return;

  CapApp.addListener('appUrlOpen', ({ url }) => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // Validate path against known routes before navigating
      if (!isAllowedDeepLink(path)) {
        console.warn('[deep-link] Rejected unknown path:', path);
        return;
      }

      // Handle auth callbacks (magic link, password reset, invite accept)
      if (path.startsWith('/auth/callback')) {
        navigate(`/auth/callback${urlObj.search}${urlObj.hash}`);
        return;
      }

      // Handle invite links
      if (path.startsWith('/accept-invite')) {
        navigate(path + urlObj.search);
        return;
      }

      // Handle parent portal deep links
      if (path.startsWith('/portal/')) {
        navigate(path);
        return;
      }

      // Handle any other deep links
      navigate(path);
    } catch {
      // Invalid URL
    }
  });
}
