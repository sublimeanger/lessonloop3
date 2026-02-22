// Shared plan configuration for all edge functions
// Frontend equivalent: src/lib/pricing-config.ts — keep in sync!

export const PLAN_LIMITS: Record<string, { max_students: number; max_teachers: number }> = {
  solo_teacher: { max_students: 9999, max_teachers: 1 },
  academy: { max_students: 9999, max_teachers: 5 },
  agency: { max_students: 9999, max_teachers: 9999 },
};

// Restricted limits applied when a subscription is cancelled or trial expires.
// These cap inserts via check_student_limit / enforce_teacher_limit DB triggers.
export const CANCELLED_LIMITS = { max_students: 5, max_teachers: 1 };

export const TRIAL_DAYS = 30;
