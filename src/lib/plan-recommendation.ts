import type { OrgType, SubscriptionPlan } from '@/hooks/useOnboardingState';

export interface RecommendationInput {
  orgType: OrgType;
  teamSize?: string;      // '1-3', '4-10', '11-25', '25+'
  locationCount?: string;  // '1', '2-3', '4+'
  studentCount?: string;   // '1-10', '11-25', '26-50', '50+'
  isSwitching?: boolean;
}

export interface PlanRecommendation {
  plan: SubscriptionPlan;
  reasons: string[];
}

/**
 * Smart plan recommendation based on all gathered onboarding data.
 * Returns a plan and human-readable reasons explaining the choice.
 */
export function getSmartRecommendation(input: RecommendationInput): PlanRecommendation {
  const { orgType, teamSize, locationCount, studentCount, isSwitching } = input;

  // ── Agency ──
  if (orgType === 'agency') {
    const reasons = ['Unlimited teachers for managing your peripatetic team'];
    if (teamSize && parseMinFromRange(teamSize) >= 11) {
      reasons.push(`Built for agencies managing ${teamSize} teachers`);
    }
    reasons.push('Dedicated account manager and SLA guarantee');
    return { plan: 'agency', reasons };
  }

  // ── Studio / Academy ──
  if (orgType === 'studio' || orgType === 'academy') {
    const teamMin = teamSize ? parseMinFromRange(teamSize) : 1;
    const locMin = locationCount ? parseMinFromRange(locationCount) : 1;

    // Large teams → Agency
    if (teamMin >= 25) {
      return {
        plan: 'agency',
        reasons: [
          `With ${teamSize} teachers, unlimited capacity gives you room to grow`,
          'Advanced analytics and dedicated account manager',
          locMin >= 4 ? 'Multi-location support included' : 'API access for custom integrations',
        ],
      };
    }

    // Standard studio/academy → Studio plan
    const reasons: string[] = [];
    if (teamMin <= 5) {
      reasons.push(`Up to 5 teachers included — perfect for your team`);
    } else {
      reasons.push(`Includes 5 teachers + just £5/month per additional teacher`);
    }
    if (locMin >= 2) {
      reasons.push('Multi-location support for your venues');
    }
    reasons.push('Team scheduling, payroll reports, and custom branding');
    if (isSwitching) {
      reasons.push('Easy migration from your current software');
    }

    return { plan: 'academy', reasons };
  }

  // ── Solo Teacher ──
  const reasons = ['Unlimited students — teach as many as you like'];
  if (studentCount) {
    const studentMin = parseMinFromRange(studentCount);
    if (studentMin >= 50) {
      reasons.push('Built for established teachers with large rosters');
    } else if (studentMin >= 26) {
      reasons.push('Growing studio with room to scale');
    }
  }
  reasons.push('Calendar, invoicing, parent portal, and LoopAssist AI');
  if (isSwitching) {
    reasons.push('Seamless import from your current software');
  }

  return { plan: 'solo_teacher', reasons };
}

/** Parse the minimum number from a range string like '4-10', '25+', '1' */
function parseMinFromRange(range: string): number {
  const cleaned = range.replace('+', '');
  const parts = cleaned.split('-');
  return parseInt(parts[0], 10) || 1;
}
