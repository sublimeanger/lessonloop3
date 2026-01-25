import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step, EVENTS, ACTIONS } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type TourName = 'dashboard' | 'calendar' | 'students' | 'invoices' | 'loopassist';

interface TourContextType {
  startTour: (tourName: TourName) => void;
  endTour: () => void;
  isRunning: boolean;
  currentTour: TourName | null;
  completedTours: TourName[];
  hasCompletedTour: (tourName: TourName) => boolean;
  resetTours: () => void;
  toursLoaded: boolean;
}

const TourContext = createContext<TourContextType | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
}

// Tour step configurations
const tourSteps: Record<TourName, Step[]> = {
  dashboard: [
    {
      target: '[data-tour="dashboard-hero"]',
      content: 'Welcome to your dashboard! This is your command centre for managing lessons, students, and billing.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="stat-cards"]',
      content: 'These cards show key metrics at a glance: today\'s lessons, outstanding invoices, and active students.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="quick-actions"]',
      content: 'Quick actions let you create lessons, add students, generate invoices, and more with a single click.',
      placement: 'top',
    },
    {
      target: '[data-tour="today-timeline"]',
      content: 'Your timeline shows today\'s schedule. Click any lesson to see details or mark attendance.',
      placement: 'left',
    },
    {
      target: '[data-tour="sidebar"]',
      content: 'Use the sidebar to navigate between Calendar, Students, Invoices, Reports, and Settings.',
      placement: 'right',
    },
    {
      target: '[data-tour="loopassist-button"]',
      content: 'Meet LoopAssist! Your AI assistant can answer questions, send reminders, and run billing. Try clicking here!',
      placement: 'left',
    },
  ],
  calendar: [
    {
      target: '[data-tour="calendar-view-toggle"]',
      content: 'Switch between Week, Month, and Agenda views to see your schedule differently.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="calendar-grid"]',
      content: 'Click any time slot to create a lesson, or click and drag to set the duration.',
      placement: 'left',
    },
    {
      target: '[data-tour="calendar-filters"]',
      content: 'Filter the calendar by teacher, location, or student to focus on specific schedules.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="create-lesson-button"]',
      content: 'Or use this button to create a new lesson with the full form.',
      placement: 'left',
    },
  ],
  students: [
    {
      target: '[data-tour="add-student-button"]',
      content: 'Click here to add a new student to your roster.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="student-list"]',
      content: 'Your students appear here. Click any row to see details, lessons, and invoices.',
      placement: 'top',
    },
    {
      target: '[data-tour="student-filters"]',
      content: 'Filter and search to find students quickly.',
      placement: 'bottom',
    },
  ],
  invoices: [
    {
      target: '[data-tour="invoice-stats"]',
      content: 'See your invoicing summary at a glance: outstanding, overdue, and paid amounts.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="billing-run-button"]',
      content: 'Run a billing run to automatically generate invoices for a date range.',
      placement: 'left',
    },
    {
      target: '[data-tour="invoice-list"]',
      content: 'All your invoices appear here. Click to view, send, or record payments.',
      placement: 'top',
    },
  ],
  loopassist: [
    {
      target: '[data-tour="loopassist-input"]',
      content: 'Type a question or request here. Try "What invoices are overdue?" or "Send reminders for unpaid invoices".',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '[data-tour="loopassist-prompts"]',
      content: 'Or click a suggested prompt to get started quickly.',
      placement: 'top',
    },
    {
      target: '[data-tour="loopassist-context"]',
      content: 'LoopAssist knows which page you\'re on and can focus on relevant data.',
      placement: 'bottom',
    },
  ],
};

// Custom styles for Joyride
const joyrideStyles = {
  options: {
    primaryColor: 'hsl(174 100% 38%)',
    textColor: 'hsl(220 60% 12%)',
    backgroundColor: '#ffffff',
    arrowColor: '#ffffff',
    overlayColor: 'rgba(10, 22, 40, 0.5)',
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: '0.625rem',
    padding: '1rem',
  },
  tooltipContent: {
    padding: '0.5rem 0',
  },
  buttonNext: {
    backgroundColor: 'hsl(174 100% 38%)',
    borderRadius: '0.375rem',
    padding: '0.5rem 1rem',
  },
  buttonBack: {
    color: 'hsl(220 40% 35%)',
    marginRight: '0.5rem',
  },
  buttonSkip: {
    color: 'hsl(220 40% 35%)',
  },
};

interface TourProviderProps {
  children: ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [currentTour, setCurrentTour] = useState<TourName | null>(null);
  const [completedTours, setCompletedTours] = useState<TourName[]>([]);
  const [toursLoaded, setToursLoaded] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  // Load completed tours from localStorage (could also be from DB)
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`lessonloop_tours_${user.id}`);
      if (stored) {
        try {
          setCompletedTours(JSON.parse(stored));
        } catch {
          setCompletedTours([]);
        }
      }
      setToursLoaded(true);
    }
  }, [user]);

  // Save completed tours
  const saveTourCompletion = useCallback((tourName: TourName) => {
    if (user) {
      const updated = [...completedTours, tourName];
      setCompletedTours(updated);
      localStorage.setItem(`lessonloop_tours_${user.id}`, JSON.stringify(updated));
    }
  }, [user, completedTours]);

  const startTour = useCallback((tourName: TourName) => {
    const tourStepConfig = tourSteps[tourName];
    if (tourStepConfig) {
      setSteps(tourStepConfig);
      setCurrentTour(tourName);
      setIsRunning(true);
    }
  }, []);

  const endTour = useCallback(() => {
    setIsRunning(false);
    setCurrentTour(null);
    setSteps([]);
  }, []);

  const hasCompletedTour = useCallback((tourName: TourName) => {
    return completedTours.includes(tourName);
  }, [completedTours]);

  const resetTours = useCallback(() => {
    if (user) {
      setCompletedTours([]);
      localStorage.removeItem(`lessonloop_tours_${user.id}`);
    }
  }, [user]);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, action, type } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    // Handle finished or skipped statuses - save completion for both
    if (finishedStatuses.includes(status as typeof STATUS.FINISHED | typeof STATUS.SKIPPED)) {
      if (currentTour) {
        saveTourCompletion(currentTour);
      }
      endTour();
      return;
    }

    // Handle close button click or skip action (before status changes)
    if (action === ACTIONS.CLOSE || action === ACTIONS.SKIP) {
      if (currentTour) {
        saveTourCompletion(currentTour);
      }
      endTour();
    }
  }, [currentTour, endTour, saveTourCompletion]);

  return (
    <TourContext.Provider
      value={{
        startTour,
        endTour,
        isRunning,
        currentTour,
        completedTours,
        hasCompletedTour,
        resetTours,
        toursLoaded,
      }}
    >
      {children}
      <Joyride
        steps={steps}
        run={isRunning}
        continuous
        showProgress
        showSkipButton
        scrollToFirstStep
        disableOverlayClose
        callback={handleJoyrideCallback}
        styles={joyrideStyles}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip tour',
        }}
      />
    </TourContext.Provider>
  );
}
