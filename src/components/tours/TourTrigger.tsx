import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTour, TourName } from './TourProvider';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Component that triggers tours based on route and completion state.
 * Place this in AppLayout to auto-start tours on first visit to pages.
 */
export function TourTrigger() {
  const location = useLocation();
  const { startTour, hasCompletedTour, isRunning } = useTour();
  const { user } = useAuth();

  useEffect(() => {
    // Don't trigger tours during another tour or if not logged in
    if (isRunning || !user) return;

    // Delay tour start slightly to ensure page is rendered
    const timer = setTimeout(() => {
      const path = location.pathname;

      // Map paths to tours
      const pathToTour: Record<string, TourName> = {
        '/dashboard': 'dashboard',
        '/calendar': 'calendar',
        '/students': 'students',
        '/invoices': 'invoices',
      };

      const tourName = pathToTour[path];
      if (tourName && !hasCompletedTour(tourName)) {
        startTour(tourName);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [location.pathname, hasCompletedTour, startTour, isRunning, user]);

  return null;
}
