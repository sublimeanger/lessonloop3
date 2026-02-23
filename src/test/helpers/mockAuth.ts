/**
 * Reusable Auth context mock values for each role.
 * Use with vi.mock('@/contexts/AuthContext') in test files.
 */
import type { AppRole } from '@/contexts/AuthContext';

interface MockProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  has_completed_onboarding: boolean;
  current_org_id: string;
  created_at: string;
  updated_at: string;
  first_run_completed: boolean;
  first_run_path: null;
}

interface MockAuthValue {
  user: { id: string; email: string; email_confirmed_at: string | null } | null;
  session: { access_token: string } | null;
  profile: MockProfile | null;
  roles: AppRole[];
  isLoading: boolean;
  isInitialised: boolean;
  signUp: ReturnType<typeof vi.fn>;
  signIn: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  resetPassword: ReturnType<typeof vi.fn>;
  updateProfile: ReturnType<typeof vi.fn>;
  refreshProfile: ReturnType<typeof vi.fn>;
  hasRole: (role: AppRole) => boolean;
  isOwnerOrAdmin: boolean;
  isTeacher: boolean;
  isParent: boolean;
}

const TEST_ORG_ID = 'test-org-001';
const TEST_USER_ID = 'test-user-001';

function createBaseProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    id: TEST_USER_ID,
    full_name: 'Test User',
    email: 'test@example.com',
    phone: null,
    has_completed_onboarding: true,
    current_org_id: TEST_ORG_ID,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    first_run_completed: true,
    first_run_path: null,
    ...overrides,
  };
}

function createMockAuth(roles: AppRole[], profileOverrides: Partial<MockProfile> = {}): MockAuthValue {
  const currentRoles = roles;
  return {
    user: { id: TEST_USER_ID, email: 'test@example.com', email_confirmed_at: '2025-01-01T00:00:00Z' },
    session: { access_token: 'mock-token' },
    profile: createBaseProfile(profileOverrides),
    roles: currentRoles,
    isLoading: false,
    isInitialised: true,
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue({ error: null }),
    updateProfile: vi.fn().mockResolvedValue({ error: null }),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    hasRole: (role: AppRole) => currentRoles.includes(role),
    isOwnerOrAdmin: currentRoles.includes('owner') || currentRoles.includes('admin'),
    isTeacher: currentRoles.includes('teacher'),
    isParent: currentRoles.includes('parent'),
  };
}

export const mockOwnerAuth = () => createMockAuth(['owner']);
export const mockAdminAuth = () => createMockAuth(['admin']);
export const mockTeacherAuth = () => createMockAuth(['teacher']);
export const mockFinanceAuth = () => createMockAuth(['finance']);
export const mockParentAuth = () => createMockAuth(['parent']);

export const mockUnauthenticated = (): MockAuthValue => ({
  user: null,
  session: null,
  profile: null,
  roles: [],
  isLoading: false,
  isInitialised: true,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  resetPassword: vi.fn(),
  updateProfile: vi.fn(),
  refreshProfile: vi.fn(),
  hasRole: () => false,
  isOwnerOrAdmin: false,
  isTeacher: false,
  isParent: false,
});

export const mockOnboardingIncomplete = (): MockAuthValue => createMockAuth(
  ['owner'],
  { has_completed_onboarding: false }
);

export const mockLoadingAuth = (): MockAuthValue => ({
  ...mockUnauthenticated(),
  isLoading: true,
  isInitialised: false,
});

export { TEST_ORG_ID, TEST_USER_ID };
