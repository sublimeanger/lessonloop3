/**
 * Centralized Pricing Configuration
 * 
 * Single source of truth for all pricing, limits, and plan features across:
 * - Marketing pages (Pricing.tsx)
 * - Onboarding (PlanSelector.tsx)
 * - Settings (BillingTab.tsx)
 * - Edge functions (stripe-subscription-checkout)
 */

export type PlanKey = 'teacher' | 'studio' | 'agency';

// Map old plan keys to new ones for database compatibility
export const PLAN_KEY_MAP: Record<string, PlanKey> = {
  solo_teacher: 'teacher',
  academy: 'studio',
  agency: 'agency',
  teacher: 'teacher',
  studio: 'studio',
};

// Map new plan keys to database enum values
export const DB_PLAN_MAP: Record<PlanKey, string> = {
  teacher: 'solo_teacher',
  studio: 'academy',
  agency: 'agency',
};

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
    includedTeachers?: number; // For Studio: base included teachers
    extraTeacherPrice?: number; // For Studio: price per additional teacher
  };
  features: string[];
  marketingFeatures: string[];
  isPopular?: boolean;
}

export const TRIAL_DAYS = 30;

export const PRICING_CONFIG: Record<PlanKey, PlanConfig> = {
  teacher: {
    name: 'Teacher',
    tagline: 'Perfect for independent music educators',
    price: {
      monthly: 12,
      yearly: 120, // ~17% savings
    },
    limits: {
      students: 9999, // Unlimited
      teachers: 1,
    },
    features: [
      'Unlimited students',
      'Calendar & scheduling',
      'Invoice generation',
      'Parent portal',
      'Practice tracking',
      'LoopAssist AI',
      'Resource library',
      'Email support',
    ],
    marketingFeatures: [
      'Unlimited students',
      'Unlimited lessons',
      'Invoicing & payments',
      'Parent portal access',
      'Practice tracking',
      'LoopAssist AI copilot',
      'Basic reporting',
      'Calendar sync',
      'Email support',
    ],
  },
  studio: {
    name: 'Studio',
    tagline: 'For music schools and growing teams',
    price: {
      monthly: 29,
      yearly: 290,
    },
    limits: {
      students: 9999, // Unlimited
      teachers: 5,
      includedTeachers: 5,
      extraTeacherPrice: 5, // +£5/teacher/month
    },
    features: [
      'Everything in Teacher',
      'Up to 5 teachers included',
      '+£5/month per extra teacher',
      'Multi-location support',
      'Team scheduling',
      'Payroll reports',
      'Bulk billing runs',
      'Custom branding',
      'Priority support',
    ],
    marketingFeatures: [
      'Unlimited students',
      '5 teachers included (+£5/extra)',
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
    tagline: 'For teaching agencies and large academies',
    price: {
      monthly: 79,
      yearly: 790,
    },
    limits: {
      students: 9999, // Unlimited
      teachers: 9999, // Unlimited
    },
    features: [
      'Everything in Studio',
      'Unlimited teachers',
      'API access',
      'Advanced analytics',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    marketingFeatures: [
      'Everything in Studio',
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
export const PLAN_ORDER: PlanKey[] = ['teacher', 'studio', 'agency'];
