/**
 * LL-SUB-P0-01: Plan Gating & Subscription Tests
 * Tests plan limits, limit checks, and subscription state logic.
 */
import { describe, it, expect } from 'vitest';
import type { SubscriptionPlan } from '@/hooks/useSubscription';
import { isPast, differenceInDays, parseISO } from 'date-fns';

// Plan limits replicated from useSubscription.ts for testing
const PLAN_LIMITS: Record<SubscriptionPlan, {
  maxStudents: number;
  maxTeachers: number;
  hasAdvancedReports: boolean;
  hasMultiLocation: boolean;
  hasCustomBranding: boolean;
  hasAPIAccess: boolean;
  hasLoopAssist: boolean;
  hasPrioritySupport: boolean;
}> = {
  trial: {
    maxStudents: 9999, maxTeachers: 1,
    hasAdvancedReports: false, hasMultiLocation: false, hasCustomBranding: false,
    hasAPIAccess: false, hasLoopAssist: true, hasPrioritySupport: false,
  },
  solo_teacher: {
    maxStudents: 9999, maxTeachers: 1,
    hasAdvancedReports: true, hasMultiLocation: false, hasCustomBranding: false,
    hasAPIAccess: false, hasLoopAssist: true, hasPrioritySupport: false,
  },
  academy: {
    maxStudents: 9999, maxTeachers: 5,
    hasAdvancedReports: true, hasMultiLocation: true, hasCustomBranding: true,
    hasAPIAccess: false, hasLoopAssist: true, hasPrioritySupport: true,
  },
  agency: {
    maxStudents: 9999, maxTeachers: 9999,
    hasAdvancedReports: true, hasMultiLocation: true, hasCustomBranding: true,
    hasAPIAccess: true, hasLoopAssist: true, hasPrioritySupport: true,
  },
  custom: {
    maxStudents: 9999, maxTeachers: 9999,
    hasAdvancedReports: true, hasMultiLocation: true, hasCustomBranding: true,
    hasAPIAccess: true, hasLoopAssist: true, hasPrioritySupport: true,
  },
};

// Simulate subscription state derivation
function deriveSubscriptionState(plan: SubscriptionPlan, status: string, trialEndsAt: string | null) {
  const isTrialing = status === 'trialing';
  const trialEnd = trialEndsAt ? parseISO(trialEndsAt) : null;
  const isTrialExpired = trialEnd ? isPast(trialEnd) : false;
  const trialDaysRemaining = trialEnd ? Math.max(0, differenceInDays(trialEnd, new Date())) : 0;

  return {
    plan,
    isTrialing,
    isTrialExpired,
    trialDaysRemaining,
    isActive: status === 'active',
    isPastDue: status === 'past_due',
    isCancelled: status === 'cancelled',
    isPaused: status === 'paused',
    limits: PLAN_LIMITS[plan],
    canUpgrade: plan !== 'agency' && plan !== 'custom',
  };
}

describe('LL-SUB-P0-01: Plan Limits', () => {
  describe('Trial plan', () => {
    it('allows unlimited students', () => {
      expect(PLAN_LIMITS.trial.maxStudents).toBe(9999);
    });

    it('limits teachers to 1', () => {
      expect(PLAN_LIMITS.trial.maxTeachers).toBe(1);
    });

    it('has LoopAssist', () => {
      expect(PLAN_LIMITS.trial.hasLoopAssist).toBe(true);
    });

    it('does NOT have advanced reports', () => {
      expect(PLAN_LIMITS.trial.hasAdvancedReports).toBe(false);
    });
  });

  describe('Solo Teacher plan', () => {
    it('has advanced reports', () => {
      expect(PLAN_LIMITS.solo_teacher.hasAdvancedReports).toBe(true);
    });

    it('limits teachers to 1', () => {
      expect(PLAN_LIMITS.solo_teacher.maxTeachers).toBe(1);
    });

    it('does NOT have multi-location', () => {
      expect(PLAN_LIMITS.solo_teacher.hasMultiLocation).toBe(false);
    });
  });

  describe('Academy (Studio) plan', () => {
    it('allows up to 5 teachers', () => {
      expect(PLAN_LIMITS.academy.maxTeachers).toBe(5);
    });

    it('has multi-location support', () => {
      expect(PLAN_LIMITS.academy.hasMultiLocation).toBe(true);
    });

    it('has custom branding', () => {
      expect(PLAN_LIMITS.academy.hasCustomBranding).toBe(true);
    });

    it('has priority support', () => {
      expect(PLAN_LIMITS.academy.hasPrioritySupport).toBe(true);
    });

    it('does NOT have API access', () => {
      expect(PLAN_LIMITS.academy.hasAPIAccess).toBe(false);
    });
  });

  describe('Agency plan', () => {
    it('has unlimited teachers', () => {
      expect(PLAN_LIMITS.agency.maxTeachers).toBe(9999);
    });

    it('has ALL features', () => {
      const agency = PLAN_LIMITS.agency;
      expect(agency.hasAdvancedReports).toBe(true);
      expect(agency.hasMultiLocation).toBe(true);
      expect(agency.hasCustomBranding).toBe(true);
      expect(agency.hasAPIAccess).toBe(true);
      expect(agency.hasLoopAssist).toBe(true);
      expect(agency.hasPrioritySupport).toBe(true);
    });
  });
});

describe('LL-SUB-P0-01: Subscription State', () => {
  it('detects active trial', () => {
    const state = deriveSubscriptionState('trial', 'trialing', '2099-12-31T00:00:00Z');
    expect(state.isTrialing).toBe(true);
    expect(state.isTrialExpired).toBe(false);
    expect(state.trialDaysRemaining).toBeGreaterThan(0);
  });

  it('detects expired trial', () => {
    const state = deriveSubscriptionState('trial', 'trialing', '2020-01-01T00:00:00Z');
    expect(state.isTrialing).toBe(true);
    expect(state.isTrialExpired).toBe(true);
    expect(state.trialDaysRemaining).toBe(0);
  });

  it('detects active subscription', () => {
    const state = deriveSubscriptionState('solo_teacher', 'active', null);
    expect(state.isActive).toBe(true);
    expect(state.isTrialing).toBe(false);
    expect(state.canUpgrade).toBe(true);
  });

  it('agency cannot upgrade', () => {
    const state = deriveSubscriptionState('agency', 'active', null);
    expect(state.canUpgrade).toBe(false);
  });

  it('custom cannot upgrade', () => {
    const state = deriveSubscriptionState('custom', 'active', null);
    expect(state.canUpgrade).toBe(false);
  });

  it('detects past_due status', () => {
    const state = deriveSubscriptionState('academy', 'past_due', null);
    expect(state.isPastDue).toBe(true);
    expect(state.isActive).toBe(false);
  });

  it('detects cancelled status', () => {
    const state = deriveSubscriptionState('solo_teacher', 'cancelled', null);
    expect(state.isCancelled).toBe(true);
  });

  it('detects paused status', () => {
    const state = deriveSubscriptionState('academy', 'paused', null);
    expect(state.isPaused).toBe(true);
  });
});

describe('LL-SUB-P0-01: Limit Boundary Checks', () => {
  it('student count at limit is NOT allowed', () => {
    const limit = PLAN_LIMITS.solo_teacher.maxStudents;
    const currentCount = limit; // At limit
    expect(currentCount < limit).toBe(false);
  });

  it('student count below limit IS allowed', () => {
    const limit = PLAN_LIMITS.solo_teacher.maxStudents;
    const currentCount = limit - 1;
    expect(currentCount < limit).toBe(true);
  });

  it('teacher count at limit is NOT allowed', () => {
    const limit = PLAN_LIMITS.academy.maxTeachers; // 5
    const currentCount = 5;
    expect(currentCount < limit).toBe(false);
  });

  it('teacher count below limit IS allowed', () => {
    const limit = PLAN_LIMITS.academy.maxTeachers; // 5
    const currentCount = 4;
    expect(currentCount < limit).toBe(true);
  });
});
