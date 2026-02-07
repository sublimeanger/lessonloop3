/**
 * Reusable Org context mock values for different org types and subscription plans.
 */
import type { AppRole } from '@/contexts/AuthContext';
import type { Organisation, SubscriptionPlan, SubscriptionStatus } from '@/contexts/OrgContext';
import { TEST_ORG_ID, TEST_USER_ID } from './mockAuth';

function createMockOrg(overrides: Partial<Organisation> = {}): Organisation {
  return {
    id: TEST_ORG_ID,
    name: 'Test Music School',
    org_type: 'solo_teacher',
    country_code: 'GB',
    currency_code: 'GBP',
    timezone: 'Europe/London',
    vat_enabled: false,
    vat_rate: 0,
    vat_registration_number: null,
    billing_approach: 'monthly',
    default_lesson_length_mins: 30,
    block_scheduling_on_closures: true,
    created_by: TEST_USER_ID,
    created_at: '2025-01-01T00:00:00Z',
    cancellation_notice_hours: 24,
    buffer_minutes_between_locations: 0,
    overdue_reminder_days: [7, 14, 28],
    auto_pause_lessons_after_days: null,
    parent_reschedule_policy: 'request_only',
    subscription_plan: 'solo_teacher',
    subscription_status: 'active',
    trial_ends_at: null,
    max_students: 9999,
    max_teachers: 1,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    ...overrides,
  };
}

interface MockOrgContextValue {
  currentOrg: Organisation | null;
  currentRole: AppRole | null;
  organisations: Organisation[];
  memberships: any[];
  isLoading: boolean;
  hasInitialised: boolean;
  hasOrgs: boolean;
  setCurrentOrg: ReturnType<typeof vi.fn>;
  createOrganisation: ReturnType<typeof vi.fn>;
  refreshOrganisations: ReturnType<typeof vi.fn>;
  isOrgAdmin: boolean;
  isOrgOwner: boolean;
}

export function createMockOrgContext(
  role: AppRole = 'owner',
  orgOverrides: Partial<Organisation> = {}
): MockOrgContextValue {
  const org = createMockOrg(orgOverrides);
  return {
    currentOrg: org,
    currentRole: role,
    organisations: [org],
    memberships: [{ id: 'mem-1', org_id: org.id, user_id: TEST_USER_ID, role, status: 'active', organisation: org }],
    isLoading: false,
    hasInitialised: true,
    hasOrgs: true,
    setCurrentOrg: vi.fn(),
    createOrganisation: vi.fn(),
    refreshOrganisations: vi.fn(),
    isOrgAdmin: role === 'owner' || role === 'admin',
    isOrgOwner: role === 'owner',
  };
}

// Convenience presets
export const mockSoloTeacherOrg = (role: AppRole = 'owner') =>
  createMockOrgContext(role, { org_type: 'solo_teacher', subscription_plan: 'solo_teacher' });

export const mockAcademyOrg = (role: AppRole = 'owner') =>
  createMockOrgContext(role, {
    org_type: 'academy',
    subscription_plan: 'academy',
    max_teachers: 5,
    vat_enabled: true,
    vat_rate: 20,
  });

export const mockAgencyOrg = (role: AppRole = 'owner') =>
  createMockOrgContext(role, {
    org_type: 'agency',
    subscription_plan: 'agency',
    max_teachers: 9999,
    vat_enabled: true,
    vat_rate: 20,
  });

export const mockTrialOrg = (role: AppRole = 'owner', expired = false) =>
  createMockOrgContext(role, {
    subscription_plan: 'trial',
    subscription_status: 'trialing',
    trial_ends_at: expired
      ? '2025-01-01T00:00:00Z' // expired
      : '2030-12-31T00:00:00Z', // far future
  });

export const mockNoOrg = (): MockOrgContextValue => ({
  currentOrg: null,
  currentRole: null,
  organisations: [],
  memberships: [],
  isLoading: false,
  hasInitialised: true,
  hasOrgs: false,
  setCurrentOrg: vi.fn(),
  createOrganisation: vi.fn(),
  refreshOrganisations: vi.fn(),
  isOrgAdmin: false,
  isOrgOwner: false,
});

export { createMockOrg };
