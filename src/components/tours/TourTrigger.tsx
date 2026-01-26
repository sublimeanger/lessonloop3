import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTour, TourName } from './TourProvider';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Component that triggers tours based on route and completion state.
 * Place this in AppLayout to auto-start tours on first visit to pages.
 * 
 * IMPORTANT: Tours only trigger ONCE per page per session to avoid annoyance.
 * They check for open dialogs/modals to avoid blocking user interactions.
 */
export function TourTrigger() {
  const location = useLocation();
  const { startTour, hasCompletedTour, isRunning, toursLoaded } = useTour();
  const { user } = useAuth();
  
  // Track which pages have already been checked THIS SESSION to avoid re-triggering
  const checkedPagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const path = location.pathname;
    
    // Don't trigger if: running another tour, not logged in, tours not loaded, or already checked this page
    if (isRunning || !user || !toursLoaded || checkedPagesRef.current.has(path)) {
      return;
    }

    // Mark this page as checked for this session
    checkedPagesRef.current.add(path);

    // Map paths to tours
    const pathToTour: Record<string, TourName> = {
      '/dashboard': 'dashboard',
      '/calendar': 'calendar',
      '/students': 'students',
      '/invoices': 'invoices',
    };

    const tourName = pathToTour[path];
    
    // Only proceed if there's a tour for this page AND user hasn't completed it
    if (!tourName || hasCompletedTour(tourName)) {
      return;
    }

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

      startTour(tourName);
    }, 1500);

    return () => clearTimeout(timer);
  }, [location.pathname, hasCompletedTour, startTour, isRunning, user, toursLoaded]);

  return null;
}
