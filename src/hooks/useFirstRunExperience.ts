import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg, OrgType } from '@/contexts/OrgContext';
import { supabase } from '@/integrations/supabase/client';

type FirstRunPath = 'solo' | 'studio' | 'academy' | 'agency';

interface FirstRunStep {
  id: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  icon: 'users' | 'calendar' | 'building' | 'user-plus' | 'settings';
}

interface FirstRunState {
  isFirstRun: boolean;
  isLoading: boolean;
  path: FirstRunPath | null;
  currentStep: FirstRunStep | null;
  steps: FirstRunStep[];
  hasStudents: boolean;
  hasLessons: boolean;
  hasLocations: boolean;
  hasTeachers: boolean;
}

// Define steps for each org type
const SOLO_STEPS: FirstRunStep[] = [
  {
    id: 'add-student',
    title: "Add your first student",
    description: "Let's get your roster started with your first student.",
    cta: 'Add Student',
    href: '/students',
    icon: 'users',
  },
  {
    id: 'schedule-lesson',
    title: "Schedule a lesson",
    description: "Create your first lesson in the calendar.",
    cta: 'Open Calendar',
    href: '/calendar',
    icon: 'calendar',
  },
];

const STUDIO_STEPS: FirstRunStep[] = [
  {
    id: 'add-location',
    title: "Set up your studio",
    description: "Add your teaching location with rooms.",
    cta: 'Add Location',
    href: '/locations',
    icon: 'building',
  },
  {
    id: 'invite-teacher',
    title: "Invite your first teacher",
    description: "Build your team by inviting teachers.",
    cta: 'Invite Teacher',
    href: '/teachers',
    icon: 'user-plus',
  },
  {
    id: 'add-student',
    title: "Add students",
    description: "Start enrolling students.",
    cta: 'Add Student',
    href: '/students',
    icon: 'users',
  },
];

const ACADEMY_STEPS: FirstRunStep[] = [
  {
    id: 'add-locations',
    title: "Set up your locations",
    description: "Add your teaching venues and configure rooms.",
    cta: 'Add Locations',
    href: '/locations',
    icon: 'building',
  },
  {
    id: 'invite-team',
    title: "Invite your team",
    description: "Add teachers and admin staff.",
    cta: 'Invite Team',
    href: '/teachers',
    icon: 'user-plus',
  },
  {
    id: 'add-students',
    title: "Enrol students",
    description: "Add students individually or import in bulk.",
    cta: 'Add Students',
    href: '/students',
    icon: 'users',
  },
];

const AGENCY_STEPS: FirstRunStep[] = [
  {
    id: 'add-client-sites',
    title: "Add your client schools",
    description: "Set up the schools and venues where your teachers work.",
    cta: 'Add Client Sites',
    href: '/locations',
    icon: 'building',
  },
  {
    id: 'invite-teachers',
    title: "Invite your teachers",
    description: "Build your team of peripatetic teachers.",
    cta: 'Invite Teachers',
    href: '/teachers',
    icon: 'user-plus',
  },
  {
    id: 'configure-policy',
    title: "Set scheduling policies",
    description: "Control how parents can request changes for school-based lessons.",
    cta: 'Configure',
    href: '/settings',
    icon: 'settings',
  },
];

function getStepsForOrgType(orgType: OrgType): FirstRunStep[] {
  switch (orgType) {
    case 'solo_teacher':
      return SOLO_STEPS;
    case 'studio':
      return STUDIO_STEPS;
    case 'academy':
      return ACADEMY_STEPS;
    case 'agency':
      return AGENCY_STEPS;
    default:
      return SOLO_STEPS;
  }
}

function getPathFromOrgType(orgType: OrgType): FirstRunPath {
  switch (orgType) {
    case 'solo_teacher':
      return 'solo';
    case 'studio':
      return 'studio';
    case 'academy':
      return 'academy';
    case 'agency':
      return 'agency';
    default:
      return 'solo';
  }
}

export function useFirstRunExperience(): FirstRunState & {
  completeFirstRun: () => Promise<void>;
  dismissFirstRun: () => void;
} {
  const { profile, user } = useAuth();
  const { currentOrg } = useOrg();
  
  const [state, setState] = useState<FirstRunState>({
    isFirstRun: false,
    isLoading: true,
    path: null,
    currentStep: null,
    steps: [],
    hasStudents: false,
    hasLessons: false,
    hasLocations: false,
    hasTeachers: false,
  });
  
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkFirstRun = async () => {
      if (!currentOrg || !user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Check if first run is already completed
      const firstRunCompleted = profile?.first_run_completed;
      if (firstRunCompleted) {
        setState(prev => ({ ...prev, isFirstRun: false, isLoading: false }));
        return;
      }

      try {
        // Check completion status in parallel
        const [studentsResult, lessonsResult, locationsResult, teachersResult] = await Promise.all([
          supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id)
            .eq('status', 'active'),
          supabase
            .from('lessons')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id),
          supabase
            .from('locations')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id),
          supabase
            .from('org_memberships')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', currentOrg.id)
            .eq('status', 'active')
            .in('role', ['teacher', 'admin']),
        ]);

        const hasStudents = (studentsResult.count || 0) > 0;
        const hasLessons = (lessonsResult.count || 0) > 0;
        const hasLocations = (locationsResult.count || 0) > 0;
        const hasTeachers = (teachersResult.count || 0) > 1; // More than just owner

        const orgType = currentOrg.org_type || 'solo_teacher';
        const path = getPathFromOrgType(orgType);
        const steps = getStepsForOrgType(orgType);

        // Determine current step based on completion
        let currentStep: FirstRunStep | null = null;
        
        if (orgType === 'solo_teacher') {
          if (!hasStudents) {
            currentStep = steps.find(s => s.id === 'add-student') || null;
          } else if (!hasLessons) {
            currentStep = steps.find(s => s.id === 'schedule-lesson') || null;
          }
        } else if (orgType === 'studio') {
          if (!hasLocations) {
            currentStep = steps.find(s => s.id === 'add-location') || null;
          } else if (!hasTeachers) {
            currentStep = steps.find(s => s.id === 'invite-teacher') || null;
          } else if (!hasStudents) {
            currentStep = steps.find(s => s.id === 'add-student') || null;
          }
        } else if (orgType === 'academy') {
          if (!hasLocations) {
            currentStep = steps.find(s => s.id === 'add-locations') || null;
          } else if (!hasTeachers) {
            currentStep = steps.find(s => s.id === 'invite-team') || null;
          } else if (!hasStudents) {
            currentStep = steps.find(s => s.id === 'add-students') || null;
          }
        } else if (orgType === 'agency') {
          if (!hasLocations) {
            currentStep = steps.find(s => s.id === 'add-client-sites') || null;
          } else if (!hasTeachers) {
            currentStep = steps.find(s => s.id === 'invite-teachers') || null;
          } else {
            currentStep = steps.find(s => s.id === 'configure-policy') || null;
          }
        }

        // Only show first-run if there's an incomplete step
        const isFirstRun = currentStep !== null;

        setState({
          isFirstRun,
          isLoading: false,
          path,
          currentStep,
          steps,
          hasStudents,
          hasLessons,
          hasLocations,
          hasTeachers,
        });
      } catch (error) {
        logger.error('Error checking first-run status:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    checkFirstRun();
  }, [currentOrg, user, profile]);

  const completeFirstRun = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ 
          first_run_completed: true,
          first_run_path: state.path,
        })
        .eq('id', user.id);

      setState(prev => ({ ...prev, isFirstRun: false }));
    } catch (error) {
      logger.error('Error completing first-run:', error);
    }
  }, [user, state.path]);

  const dismissFirstRun = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return {
    ...state,
    isFirstRun: state.isFirstRun && !isDismissed,
    completeFirstRun,
    dismissFirstRun,
  };
}
