import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTour, TourName } from './TourProvider';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Component that triggers tours based on route and completion state.
 * Tours only auto-start ONCE ever (persisted in localStorage).
 * Session tracking prevents re-attempts within a session.
 */
export function TourTrigger() {
  const location = useLocation();
  const { startTour, hasCompletedTour, isRunning, toursLoaded } = useTour();
  const { user } = useAuth();
  
  // Track which tours we've already ATTEMPTED to start this session
  // This prevents re-triggering if effect re-runs due to dependency changes
  const attemptedToursRef = useRef<Set<TourName>>(new Set());

  useEffect(() => {
    // Wait for all prerequisites
    if (isRunning || !user || !toursLoaded) {
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
    
    // No tour for this page
    if (!tourName) {
      return;
    }

    // Already attempted this tour this session (regardless of outcome)
    if (attemptedToursRef.current.has(tourName)) {
      return;
    }

    // Already completed this tour (persisted in localStorage)
    if (hasCompletedTour(tourName)) {
      // Mark as attempted so we don't re-check
      attemptedToursRef.current.add(tourName);
      return;
    }

    // Mark as attempted BEFORE the timeout
    attemptedToursRef.current.add(tourName);

    // Delay to ensure page is rendered and check for open dialogs
    const timer = setTimeout(() => {
      // Check if any dialog/modal is currently open
      const hasOpenDialog = document.querySelector('[data-state="open"][role="dialog"]') !== null;
      const hasOpenSheet = document.querySelector('[data-state="open"][data-vaul-drawer]') !== null;
      const hasOpenAlertDialog = document.querySelector('[data-state="open"][role="alertdialog"]') !== null;
      
      if (hasOpenDialog || hasOpenSheet || hasOpenAlertDialog) {
        // Remove from attempted so we can try again later
        attemptedToursRef.current.delete(tourName);
        return;
      }

      // Final check - tour might have been completed while we waited
      if (!hasCompletedTour(tourName)) {
        startTour(tourName);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [location.pathname, hasCompletedTour, startTour, isRunning, user, toursLoaded]);

  return null;
}
