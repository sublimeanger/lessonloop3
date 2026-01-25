/**
 * Centralized Pricing Configuration
 * 
 * Single source of truth for all pricing, limits, and plan features across:
 * - Marketing pages (Pricing.tsx)
 * - Onboarding (PlanSelector.tsx)
 * - Settings (BillingTab.tsx)
 * - Edge functions (stripe-subscription-checkout)
 */

export type PlanKey = 'solo_teacher' | 'academy' | 'agency';

export interface PlanConfig {
  name: string;
  tagline: string;
  price: {
    monthly: number;
    yearly: number;
  };
  limits: {
    students: number;
    teachers: number;
  };
  features: string[];
  marketingFeatures: string[];
  isPopular?: boolean;
}

export const PRICING_CONFIG: Record<PlanKey, PlanConfig> = {
  solo_teacher: {
    name: 'Solo Teacher',
    tagline: 'Perfect for independent music educators',
    price: {
      monthly: 19,
      yearly: 190, // ~2 months free
    },
    limits: {
      students: 30,
      teachers: 1,
    },
    features: [
      'Calendar & scheduling',
      'Student management',
      'Invoice generation',
      'Parent portal',
      'Practice tracking',
      'LoopAssist AI',
      'Email support',
    ],
    marketingFeatures: [
      'Up to 30 students',
      'Unlimited lessons',
      'Invoicing & payments',
      'Parent portal access',
      'Email support',
      'Practice tracking',
      'Basic reporting',
      'Calendar sync',
    ],
  },
  academy: {
    name: 'Academy',
    tagline: 'For music schools, studios, and growing teams',
    price: {
      monthly: 49,
      yearly: 490,
    },
    limits: {
      students: 150,
      teachers: 10,
    },
    features: [
      'Everything in Solo Teacher',
      'Multi-teacher support',
      'Multi-location management',
      'Team scheduling',
      'Payroll reports',
      'Bulk billing runs',
      'Custom branding',
      'Priority support',
    ],
    marketingFeatures: [
      'Up to 150 students',
      'Up to 10 teachers',
      'Multi-location support',
      'Advanced scheduling',
      'Bulk invoicing',
      'LoopAssist AI copilot',
      'Priority support',
      'Custom branding',
      'Advanced reporting',
      'Resource library',
    ],
    isPopular: true,
  },
  agency: {
    name: 'Agency',
    tagline: 'For teaching agencies and large multi-site academies',
    price: {
      monthly: 99,
      yearly: 990,
    },
    limits: {
      students: 9999, // Effectively unlimited
      teachers: 9999,
    },
    features: [
      'Everything in Academy',
      'Unlimited students & teachers',
      'API access',
      'Advanced analytics',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    marketingFeatures: [
      'Everything in Academy',
      'Unlimited teachers',
      'Teacher payroll',
      'API access',
      'Dedicated account manager',
      'SLA guarantee',
      'Custom integrations',
      'White-label options',
      'On-site training',
      'SSO / SAML',
    ],
  },
};

// Helper to calculate yearly discount percentage
export function getYearlyDiscount(planKey: PlanKey): number {
  const plan = PRICING_CONFIG[planKey];
  return Math.round((1 - plan.price.yearly / (plan.price.monthly * 12)) * 100);
}

// Helper to format price display
export function formatPrice(amount: number, interval: 'monthly' | 'yearly'): string {
  if (interval === 'yearly') {
    return `£${Math.round(amount / 12)}`;
  }
  return `£${amount}`;
}

// Helper to get display limits
export function formatLimit(value: number): string {
  return value >= 9999 ? 'Unlimited' : value.toString();
}

// Plan order for display
export const PLAN_ORDER: PlanKey[] = ['solo_teacher', 'academy', 'agency'];
