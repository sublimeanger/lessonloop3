import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { platform } from '@/lib/platform';

/**
 * Handle Android hardware back button.
 * - On root pages (dashboard, portal home): minimise the app
 * - On other pages: navigate back in history
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!platform.isAndroid) return;

    const rootPaths = ['/dashboard', '/portal/home', '/login'];

    const listener = App.addListener('backButton', ({ canGoBack }) => {
      const isRootPage = rootPaths.includes(location.pathname);

      if (isRootPage) {
        // Minimise app on root pages instead of exiting
        App.minimizeApp();
      } else if (canGoBack) {
        navigate(-1);
      } else {
        App.minimizeApp();
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate, location.pathname]);
}
