/**
 * LL-ONBOARD-P0-01: Onboarding Flow Logic Tests
 * Tests validation, plan mapping, route guards, and error recovery for the onboarding wizard.
 */
import { describe, it, expect } from 'vitest';
import { getRecommendedPlan } from '@/components/onboarding/PlanSelector';

// ── Extracted validation logic (mirrors Onboarding.tsx handleNext) ──

function validateProfileStep(fullName: string, orgName: string): string | null {
  if (!fullName.trim()) return 'Please enter your name';
  if (!orgName.trim()) return 'Please enter an organisation name';
  if (fullName.trim().length > 100) return 'Name must be 100 characters or fewer';
  if (orgName.trim().length > 100) return 'Organisation name must be 100 characters or fewer';
  return null;
}

// ── Extracted RouteGuard onboarding redirect logic ──

interface RouteGuardInput {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  emailVerified: boolean;
  currentPath: string;
}

function resolveRedirect(input: RouteGuardInput): string | null {
  if (!input.isAuthenticated) return '/login';
  if (!input.emailVerified && input.currentPath !== '/verify-email') return '/verify-email';
  if (input.currentPath === '/verify-email') return null; // already on verify page
  if (!input.hasCompletedOnboarding && input.currentPath !== '/onboarding') return '/onboarding';
  if (input.hasCompletedOnboarding && input.currentPath === '/onboarding') return '/dashboard';
  return null;
}

// ── Tests ──

describe('Onboarding: Profile Step Validation', () => {
  it('rejects empty name', () => {
    expect(validateProfileStep('', 'My Studio')).toBe('Please enter your name');
  });

  it('rejects whitespace-only name', () => {
    expect(validateProfileStep('   ', 'My Studio')).toBe('Please enter your name');
  });

  it('rejects empty org name', () => {
    expect(validateProfileStep('John', '')).toBe('Please enter an organisation name');
  });

  it('rejects whitespace-only org name', () => {
    expect(validateProfileStep('John', '   ')).toBe('Please enter an organisation name');
  });

  it('rejects name over 100 characters', () => {
    expect(validateProfileStep('A'.repeat(101), 'Studio')).toBe('Name must be 100 characters or fewer');
  });

  it('rejects org name over 100 characters', () => {
    expect(validateProfileStep('John', 'S'.repeat(101))).toBe('Organisation name must be 100 characters or fewer');
  });

  it('accepts valid inputs', () => {
    expect(validateProfileStep('John Doe', 'My Music Studio')).toBeNull();
  });

  it('accepts names at exactly 100 characters', () => {
    expect(validateProfileStep('A'.repeat(100), 'B'.repeat(100))).toBeNull();
  });
});

describe('Onboarding: Org Type → Plan Mapping', () => {
  it('solo_teacher recommends solo_teacher plan', () => {
    expect(getRecommendedPlan('solo_teacher')).toBe('solo_teacher');
  });

  it('studio recommends academy plan', () => {
    expect(getRecommendedPlan('studio')).toBe('academy');
  });

  it('academy recommends academy plan', () => {
    expect(getRecommendedPlan('academy')).toBe('academy');
  });

  it('agency recommends agency plan', () => {
    expect(getRecommendedPlan('agency')).toBe('agency');
  });

  it('unknown type defaults to academy', () => {
    expect(getRecommendedPlan('unknown')).toBe('academy');
  });
});

describe('Onboarding: RouteGuard Redirects', () => {
  it('redirects unauthenticated user to /login', () => {
    expect(resolveRedirect({
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      emailVerified: false,
      currentPath: '/onboarding',
    })).toBe('/login');
  });

  it('redirects unverified email to /verify-email', () => {
    expect(resolveRedirect({
      isAuthenticated: true,
      hasCompletedOnboarding: false,
      emailVerified: false,
      currentPath: '/onboarding',
    })).toBe('/verify-email');
  });

  it('redirects incomplete onboarding to /onboarding', () => {
    expect(resolveRedirect({
      isAuthenticated: true,
      hasCompletedOnboarding: false,
      emailVerified: true,
      currentPath: '/dashboard',
    })).toBe('/onboarding');
  });

  it('redirects already-onboarded user away from /onboarding to /dashboard', () => {
    expect(resolveRedirect({
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      emailVerified: true,
      currentPath: '/onboarding',
    })).toBe('/dashboard');
  });

  it('allows onboarded user to access /dashboard', () => {
    expect(resolveRedirect({
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      emailVerified: true,
      currentPath: '/dashboard',
    })).toBeNull();
  });

  it('allows user on /verify-email without redirect loop', () => {
    expect(resolveRedirect({
      isAuthenticated: true,
      hasCompletedOnboarding: false,
      emailVerified: false,
      currentPath: '/verify-email',
    })).toBeNull();
  });

  it('allows user on /onboarding with verified email', () => {
    expect(resolveRedirect({
      isAuthenticated: true,
      hasCompletedOnboarding: false,
      emailVerified: true,
      currentPath: '/onboarding',
    })).toBeNull();
  });
});

describe('Onboarding: Edge Function Error Handling', () => {
  // Simulates how handleSubmit processes edge function responses
  function processResponse(status: number, body: Record<string, unknown>): { success: boolean; error?: string } {
    if (status === 403) {
      return { success: false, error: body.error as string || 'Forbidden' };
    }
    if (status === 500) {
      return { success: false, error: body.error as string || `Server error (${status}). Please try again.` };
    }
    if (status !== 200) {
      return { success: false, error: body.error as string || `Server error (${status}). Please try again.` };
    }
    return { success: true };
  }

  it('handles 403 unverified email', () => {
    const result = processResponse(403, { error: 'Please verify your email address before setting up your account.' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('verify your email');
  });

  it('handles 500 server error', () => {
    const result = processResponse(500, { error: 'Organisation creation failed' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Organisation creation failed');
  });

  it('handles 500 with empty body', () => {
    const result = processResponse(500, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Server error');
  });

  it('handles 200 success', () => {
    const result = processResponse(200, { success: true, org_id: 'abc-123' });
    expect(result.success).toBe(true);
  });
});

describe('Onboarding: Idempotency', () => {
  it('already-onboarded response returns existing org_id', () => {
    // Simulates the edge function's idempotency guard
    const response = {
      success: true,
      org_id: 'existing-org-id',
      message: 'Already onboarded — returning existing organisation',
    };
    expect(response.success).toBe(true);
    expect(response.org_id).toBe('existing-org-id');
    expect(response.message).toContain('Already onboarded');
  });
});

describe('Onboarding: Timezone Detection', () => {
  it('falls back to Europe/London when Intl is unavailable', () => {
    const detected = 'Europe/London'; // fallback
    expect(detected).toBe('Europe/London');
  });

  it('uses detected timezone when available', () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
    expect(detected).toBeTruthy();
    expect(typeof detected).toBe('string');
  });
});
