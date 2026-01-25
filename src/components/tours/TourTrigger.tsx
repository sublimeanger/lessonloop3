import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTour, TourName } from './TourProvider';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Component that triggers tours based on route and completion state.
 * Place this in AppLayout to auto-start tours on first visit to pages.
 * 
 * IMPORTANT: Tours are delayed and check for open dialogs/modals to avoid
 * blocking user interactions with modal content.
 */
export function TourTrigger() {
  const location = useLocation();
  const { startTour, hasCompletedTour, isRunning } = useTour();
  const { user } = useAuth();
  const [hasNavigated, setHasNavigated] = useState(false);

  // Track navigation to avoid triggering on initial render
  useEffect(() => {
    setHasNavigated(true);
  }, [location.pathname]);

  useEffect(() => {
    // Don't trigger tours during another tour or if not logged in
    if (isRunning || !user || !hasNavigated) return;

    // Delay tour start to ensure page is rendered and check for open dialogs
    const timer = setTimeout(() => {
      // Check if any dialog/modal is currently open (Radix UI pattern)
      const hasOpenDialog = document.querySelector('[data-state="open"][role="dialog"]') !== null;
      const hasOpenSheet = document.querySelector('[data-state="open"][data-vaul-drawer]') !== null;
      const hasOpenAlertDialog = document.querySelector('[data-state="open"][role="alertdialog"]') !== null;
      
      // Don't start tour if any modal is open
      if (hasOpenDialog || hasOpenSheet || hasOpenAlertDialog) {
        return;
      }

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
    }, 1500); // Slightly longer delay to allow modals to register

    return () => clearTimeout(timer);
  }, [location.pathname, hasCompletedTour, startTour, isRunning, user, hasNavigated]);

  return null;
}
