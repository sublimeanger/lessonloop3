import { useMemo } from 'react';
import { useSubscription, SubscriptionPlan } from './useSubscription';

export type Feature = 
  | 'advanced_reports'
  | 'multi_location'
  | 'custom_branding'
  | 'api_access'
  | 'loop_assist'
  | 'priority_support'
  | 'bulk_messaging'
  | 'payroll_reports'
  | 'billing_runs'
  | 'resource_library'
  | 'practice_tracking'
  | 'parent_portal'
  | 'calendar_sync';

// Define which features are available on each plan
const FEATURE_MATRIX: Record<Feature, SubscriptionPlan[]> = {
  // Core features available to all plans (including trial)
  advanced_reports: ['solo_teacher', 'academy', 'agency', 'custom'],
  multi_location: ['academy', 'agency', 'custom'],
  custom_branding: ['academy', 'agency', 'custom'],
  api_access: ['agency', 'custom'],
  loop_assist: ['trial', 'solo_teacher', 'academy', 'agency', 'custom'],
  priority_support: ['academy', 'agency', 'custom'],
  bulk_messaging: ['solo_teacher', 'academy', 'agency', 'custom'],
  payroll_reports: ['academy', 'agency', 'custom'],
  billing_runs: ['solo_teacher', 'academy', 'agency', 'custom'],
  resource_library: ['trial', 'solo_teacher', 'academy', 'agency', 'custom'],
  practice_tracking: ['trial', 'solo_teacher', 'academy', 'agency', 'custom'],
  parent_portal: ['trial', 'solo_teacher', 'academy', 'agency', 'custom'],
  calendar_sync: ['solo_teacher', 'academy', 'agency', 'custom'],
};

// Define minimum plan required for each feature (for upgrade prompts)
const FEATURE_MIN_PLAN: Record<Feature, SubscriptionPlan> = {
  advanced_reports: 'solo_teacher',
  multi_location: 'academy',
  custom_branding: 'academy',
  api_access: 'agency',
  loop_assist: 'trial',
  priority_support: 'academy',
  bulk_messaging: 'solo_teacher',
  payroll_reports: 'academy',
  billing_runs: 'solo_teacher',
  resource_library: 'trial',
  practice_tracking: 'trial',
  parent_portal: 'trial',
  calendar_sync: 'solo_teacher',
};

// Human-readable feature names
export const FEATURE_NAMES: Record<Feature, string> = {
  advanced_reports: 'Advanced Reports',
  multi_location: 'Multi-Location Support',
  custom_branding: 'Custom Branding',
  api_access: 'API Access',
  loop_assist: 'LoopAssist AI',
  priority_support: 'Priority Support',
  bulk_messaging: 'Bulk Messaging',
  payroll_reports: 'Payroll Reports',
  billing_runs: 'Billing Runs',
  resource_library: 'Resource Library',
  practice_tracking: 'Practice Tracking',
  parent_portal: 'Parent Portal',
  calendar_sync: 'Calendar Sync',
};

// Human-readable plan names - matches new pricing branding
export const PLAN_NAMES: Record<SubscriptionPlan, string> = {
  trial: 'Trial',
  solo_teacher: 'Teacher',
  academy: 'Studio',
  agency: 'Agency',
  custom: 'Custom',
};

export interface FeatureGateResult {
  hasAccess: boolean;
  requiredPlan: SubscriptionPlan;
  requiredPlanName: string;
  featureName: string;
  isTrialBlocked: boolean;
}

export function useFeatureGate(feature: Feature): FeatureGateResult {
  const { plan, isTrialing, isTrialExpired } = useSubscription();

  return useMemo(() => {
    const allowedPlans = FEATURE_MATRIX[feature];
    const hasAccess = allowedPlans.includes(plan) && (!isTrialing || !isTrialExpired);
    const requiredPlan = FEATURE_MIN_PLAN[feature];
    
    return {
      hasAccess,
      requiredPlan,
      requiredPlanName: PLAN_NAMES[requiredPlan],
      featureName: FEATURE_NAMES[feature],
      isTrialBlocked: isTrialing && isTrialExpired,
    };
  }, [feature, plan, isTrialing, isTrialExpired]);
}

// Hook to check multiple features at once
export function useFeatureGates(features: Feature[]): Record<Feature, FeatureGateResult> {
  const { plan, isTrialing, isTrialExpired } = useSubscription();

  return useMemo(() => {
    const results: Record<string, FeatureGateResult> = {};
    
    for (const feature of features) {
      const allowedPlans = FEATURE_MATRIX[feature];
      const hasAccess = allowedPlans.includes(plan) && (!isTrialing || !isTrialExpired);
      const requiredPlan = FEATURE_MIN_PLAN[feature];
      
      results[feature] = {
        hasAccess,
        requiredPlan,
        requiredPlanName: PLAN_NAMES[requiredPlan],
        featureName: FEATURE_NAMES[feature],
        isTrialBlocked: isTrialing && isTrialExpired,
      };
    }
    
    return results as Record<Feature, FeatureGateResult>;
  }, [features, plan, isTrialing, isTrialExpired]);
}

// Utility to get the next upgrade tier
export function getUpgradePath(currentPlan: SubscriptionPlan): SubscriptionPlan | null {
  const upgradePath: Record<SubscriptionPlan, SubscriptionPlan | null> = {
    trial: 'solo_teacher',
    solo_teacher: 'academy',
    academy: 'agency',
    agency: null,
    custom: null,
  };
  return upgradePath[currentPlan];
}
