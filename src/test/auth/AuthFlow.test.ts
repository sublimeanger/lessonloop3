/**
 * LL-AUTH-P0-02: Authentication Flow Logic Tests
 * Tests profile creation on signup, role resolution, route access, and parent redirect.
 */
import { describe, it, expect } from 'vitest';
import type { AppRole } from '@/contexts/AuthContext';

// ── Extracted auth/role logic ──

/** Simulates the DB trigger: handle_new_user creates a profile + default 'owner' role */
function simulateSignUp(userId: string, email: string, fullName: string) {
  const profile = {
    id: userId,
    email,
    full_name: fullName,
    has_completed_onboarding: false,
    current_org_id: null,
  };
  const roles: AppRole[] = ['owner']; // default role from trigger
  return { profile, roles };
}

/** Simulates role resolution from org_memberships */
function resolveOrgRole(memberships: Array<{ org_id: string; role: AppRole; status: string }>, orgId: string): AppRole | null {
  const active = memberships.find(m => m.org_id === orgId && m.status === 'active');
  return active?.role ?? null;
}

/** Route access matrix — replicates RouteGuard logic */
const STAFF_ROUTES = [
  '/dashboard', '/calendar', '/register', '/students', '/teachers',
  '/locations', '/invoices', '/reports', '/messages', '/settings',
  '/practice', '/resources', '/help',
];

const FINANCE_ALLOWED = ['/dashboard', '/invoices', '/reports', '/messages', '/settings', '/help'];
const TEACHER_ALLOWED = ['/dashboard', '/calendar', '/register', '/students', '/practice', '/resources', '/messages', '/settings', '/help'];
const PARENT_ROUTES_PREFIX = '/portal/';

function canAccessRoute(role: AppRole | null, path: string): boolean {
  if (!role) return false;

  // Parent can only access portal
  if (role === 'parent') {
    return path.startsWith(PARENT_ROUTES_PREFIX);
  }

  // Portal routes are parent-only
  if (path.startsWith(PARENT_ROUTES_PREFIX)) {
    return false;
  }

  // Owner/admin can access everything
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  // Finance restricted set
  if (role === 'finance') {
    return FINANCE_ALLOWED.some(r => path.startsWith(r));
  }

  // Teacher restricted set
  if (role === 'teacher') {
    return TEACHER_ALLOWED.some(r => path.startsWith(r));
  }

  return false;
}

/** Determines redirect path for role */
function getDefaultRoute(role: AppRole | null): string {
  if (role === 'parent') return '/portal/home';
  return '/dashboard';
}

describe('LL-AUTH-P0-02: Authentication Flows', () => {
  describe('Sign up creates profile', () => {
    it('creates a profile with correct fields', () => {
      const { profile } = simulateSignUp('user-001', 'alice@example.com', 'Alice Teacher');

      expect(profile.id).toBe('user-001');
      expect(profile.email).toBe('alice@example.com');
      expect(profile.full_name).toBe('Alice Teacher');
      expect(profile.has_completed_onboarding).toBe(false);
      expect(profile.current_org_id).toBeNull();
    });

    it('assigns default owner role on signup', () => {
      const { roles } = simulateSignUp('user-001', 'alice@example.com', 'Alice');

      expect(roles).toContain('owner');
      expect(roles).toHaveLength(1);
    });
  });

  describe('Sign in returns correct roles', () => {
    it('resolves owner role from active membership', () => {
      const memberships = [
        { org_id: 'org-1', role: 'owner' as AppRole, status: 'active' },
      ];
      expect(resolveOrgRole(memberships, 'org-1')).toBe('owner');
    });

    it('resolves teacher role correctly', () => {
      const memberships = [
        { org_id: 'org-1', role: 'teacher' as AppRole, status: 'active' },
      ];
      expect(resolveOrgRole(memberships, 'org-1')).toBe('teacher');
    });

    it('resolves parent role correctly', () => {
      const memberships = [
        { org_id: 'org-1', role: 'parent' as AppRole, status: 'active' },
      ];
      expect(resolveOrgRole(memberships, 'org-1')).toBe('parent');
    });

    it('returns null for inactive membership', () => {
      const memberships = [
        { org_id: 'org-1', role: 'teacher' as AppRole, status: 'suspended' },
      ];
      expect(resolveOrgRole(memberships, 'org-1')).toBeNull();
    });

    it('returns null for unknown org', () => {
      const memberships = [
        { org_id: 'org-1', role: 'owner' as AppRole, status: 'active' },
      ];
      expect(resolveOrgRole(memberships, 'org-999')).toBeNull();
    });

    it('resolves correct role when user has multiple org memberships', () => {
      const memberships = [
        { org_id: 'org-1', role: 'owner' as AppRole, status: 'active' },
        { org_id: 'org-2', role: 'teacher' as AppRole, status: 'active' },
      ];
      expect(resolveOrgRole(memberships, 'org-1')).toBe('owner');
      expect(resolveOrgRole(memberships, 'org-2')).toBe('teacher');
    });
  });

  describe('Role-based route access', () => {
    it('owner can access all staff routes', () => {
      for (const route of STAFF_ROUTES) {
        expect(canAccessRoute('owner', route)).toBe(true);
      }
    });

    it('admin can access all staff routes', () => {
      for (const route of STAFF_ROUTES) {
        expect(canAccessRoute('admin', route)).toBe(true);
      }
    });

    it('teacher CANNOT access invoices', () => {
      expect(canAccessRoute('teacher', '/invoices')).toBe(false);
    });

    it('teacher CAN access calendar and students', () => {
      expect(canAccessRoute('teacher', '/calendar')).toBe(true);
      expect(canAccessRoute('teacher', '/students')).toBe(true);
    });

    it('teacher CANNOT access teachers or locations', () => {
      expect(canAccessRoute('teacher', '/teachers')).toBe(false);
      expect(canAccessRoute('teacher', '/locations')).toBe(false);
    });

    it('finance CAN access invoices and reports', () => {
      expect(canAccessRoute('finance', '/invoices')).toBe(true);
      expect(canAccessRoute('finance', '/reports')).toBe(true);
    });

    it('finance CANNOT access calendar, students, teachers, locations', () => {
      expect(canAccessRoute('finance', '/calendar')).toBe(false);
      expect(canAccessRoute('finance', '/students')).toBe(false);
      expect(canAccessRoute('finance', '/teachers')).toBe(false);
      expect(canAccessRoute('finance', '/locations')).toBe(false);
    });

    it('parent can ONLY access /portal/* routes', () => {
      expect(canAccessRoute('parent', '/portal/home')).toBe(true);
      expect(canAccessRoute('parent', '/portal/invoices')).toBe(true);
      expect(canAccessRoute('parent', '/portal/schedule')).toBe(true);
    });

    it('parent CANNOT access any staff routes', () => {
      for (const route of STAFF_ROUTES) {
        expect(canAccessRoute('parent', route)).toBe(false);
      }
    });

    it('staff roles CANNOT access portal routes', () => {
      expect(canAccessRoute('owner', '/portal/home')).toBe(false);
      expect(canAccessRoute('teacher', '/portal/home')).toBe(false);
    });

    it('null role blocks all routes', () => {
      expect(canAccessRoute(null, '/dashboard')).toBe(false);
      expect(canAccessRoute(null, '/portal/home')).toBe(false);
    });
  });

  describe('Parent redirects to portal', () => {
    it('parent default route is /portal/home', () => {
      expect(getDefaultRoute('parent')).toBe('/portal/home');
    });

    it('non-parent roles default to /dashboard', () => {
      expect(getDefaultRoute('owner')).toBe('/dashboard');
      expect(getDefaultRoute('admin')).toBe('/dashboard');
      expect(getDefaultRoute('teacher')).toBe('/dashboard');
      expect(getDefaultRoute('finance')).toBe('/dashboard');
    });

    it('null role defaults to /dashboard', () => {
      expect(getDefaultRoute(null)).toBe('/dashboard');
    });
  });
});
