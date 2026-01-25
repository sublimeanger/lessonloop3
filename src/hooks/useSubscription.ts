import { useMemo } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { differenceInDays, isPast, parseISO } from 'date-fns';

export type SubscriptionPlan = 'trial' | 'solo_teacher' | 'academy' | 'agency' | 'custom';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused';

export interface PlanLimits {
  maxStudents: number;
  maxTeachers: number;
  hasAdvancedReports: boolean;
  hasMultiLocation: boolean;
  hasCustomBranding: boolean;
  hasAPIAccess: boolean;
  hasLoopAssist: boolean;
  hasPrioritySupport: boolean;
}

export interface SubscriptionState {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  trialDaysRemaining: number;
  isTrialExpired: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isCancelled: boolean;
  isPaused: boolean;
  limits: PlanLimits;
  canUpgrade: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  trial: {
    maxStudents: 10,
    maxTeachers: 1,
    hasAdvancedReports: false,
    hasMultiLocation: false,
    hasCustomBranding: false,
    hasAPIAccess: false,
    hasLoopAssist: true, // Allow during trial
    hasPrioritySupport: false,
  },
  solo_teacher: {
    maxStudents: 30,
    maxTeachers: 1,
    hasAdvancedReports: true,
    hasMultiLocation: false,
    hasCustomBranding: false,
    hasAPIAccess: false,
    hasLoopAssist: true,
    hasPrioritySupport: false,
  },
  academy: {
    maxStudents: 150,
    maxTeachers: 10,
    hasAdvancedReports: true,
    hasMultiLocation: true,
    hasCustomBranding: true,
    hasAPIAccess: false,
    hasLoopAssist: true,
    hasPrioritySupport: true,
  },
  agency: {
    maxStudents: 9999,
    maxTeachers: 9999,
    hasAdvancedReports: true,
    hasMultiLocation: true,
    hasCustomBranding: true,
    hasAPIAccess: true,
    hasLoopAssist: true,
    hasPrioritySupport: true,
  },
  custom: {
    maxStudents: 9999,
    maxTeachers: 9999,
    hasAdvancedReports: true,
    hasMultiLocation: true,
    hasCustomBranding: true,
    hasAPIAccess: true,
    hasLoopAssist: true,
    hasPrioritySupport: true,
  },
};

export function useSubscription(): SubscriptionState {
  const { currentOrg } = useOrg();

  return useMemo(() => {
    const plan = (currentOrg?.subscription_plan as SubscriptionPlan) || 'trial';
    const status = (currentOrg?.subscription_status as SubscriptionStatus) || 'trialing';
    const trialEndsAtRaw = currentOrg?.trial_ends_at;
    const trialEndsAt = trialEndsAtRaw ? parseISO(trialEndsAtRaw) : null;
    
    const isTrialing = status === 'trialing';
    const isTrialExpired = trialEndsAt ? isPast(trialEndsAt) : false;
    const trialDaysRemaining = trialEndsAt 
      ? Math.max(0, differenceInDays(trialEndsAt, new Date())) 
      : 0;

    // Use org's max_students/max_teachers if set, otherwise use plan defaults
    const baseLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    const limits: PlanLimits = {
      ...baseLimits,
      maxStudents: currentOrg?.max_students ?? baseLimits.maxStudents,
      maxTeachers: currentOrg?.max_teachers ?? baseLimits.maxTeachers,
    };

    return {
      plan,
      status,
      isTrialing,
      trialEndsAt,
      trialDaysRemaining,
      isTrialExpired,
      isActive: status === 'active',
      isPastDue: status === 'past_due',
      isCancelled: status === 'cancelled',
      isPaused: status === 'paused',
      limits,
      canUpgrade: plan !== 'agency' && plan !== 'custom',
      stripeCustomerId: currentOrg?.stripe_customer_id ?? null,
      stripeSubscriptionId: currentOrg?.stripe_subscription_id ?? null,
    };
  }, [currentOrg]);
}

// Utility to check if a specific limit is reached
export function useLimitCheck() {
  const { limits } = useSubscription();
  const { currentOrg } = useOrg();

  return useMemo(() => ({
    checkStudentLimit: async (currentCount: number): Promise<{ allowed: boolean; limit: number }> => {
      return {
        allowed: currentCount < limits.maxStudents,
        limit: limits.maxStudents,
      };
    },
    checkTeacherLimit: async (currentCount: number): Promise<{ allowed: boolean; limit: number }> => {
      return {
        allowed: currentCount < limits.maxTeachers,
        limit: limits.maxTeachers,
      };
    },
  }), [limits]);
}
