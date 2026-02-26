import { App as CapApp } from '@capacitor/app';
import { platform } from '../platform';

export function initDeepLinks(navigate: (path: string) => void) {
  if (!platform.isNative) return;

  CapApp.addListener('appUrlOpen', ({ url }) => {
    try {
      const urlObj = new URL(url);

      // Handle auth callbacks (magic link, password reset, invite accept)
      if (urlObj.pathname.startsWith('/auth/callback')) {
        navigate(`/auth/callback${urlObj.search}${urlObj.hash}`);
        return;
      }

      // Handle invite links
      if (urlObj.pathname.startsWith('/accept-invite')) {
        navigate(urlObj.pathname + urlObj.search);
        return;
      }

      // Handle parent portal deep links
      if (urlObj.pathname.startsWith('/portal/')) {
        navigate(urlObj.pathname);
        return;
      }

      // Handle any other deep links
      navigate(urlObj.pathname);
    } catch {
      // Invalid URL
    }
  });
}
