import { useMemo } from 'react';
import { useFeatureGate, type Feature } from './useFeatureGate';

/**
 * Returns which optional portal sections are enabled for the current org.
 * Always-visible pages (Home, Schedule, Messages, Profile) are not gated.
 */
export function usePortalFeatures() {
  const practice = useFeatureGate('practice_tracking');
  const resources = useFeatureGate('resource_library');
  const billing = useFeatureGate('billing_runs');

  return useMemo(() => ({
    practiceEnabled: practice.hasAccess,
    resourcesEnabled: resources.hasAccess,
    invoicesEnabled: billing.hasAccess,
  }), [practice.hasAccess, resources.hasAccess, billing.hasAccess]);
}
