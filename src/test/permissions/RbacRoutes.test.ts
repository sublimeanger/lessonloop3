import { describe, expect, it } from 'vitest';
import { canRoleAccess } from '@/config/routes';

/**
 * LL-SEC-RBAC: Route-level authorization matrix checks.
 * Mirrors audit checklist entries for role route access boundaries.
 */
describe('LL-SEC-RBAC: Route access matrix', () => {
  it('teacher cannot access admin-only routes', () => {
    expect(canRoleAccess('/teachers', 'teacher')).toBe(false);
    expect(canRoleAccess('/locations', 'teacher')).toBe(false);
    expect(canRoleAccess('/students/import', 'teacher')).toBe(false);
  });

  it('finance can access invoices but not lesson creation routes', () => {
    expect(canRoleAccess('/invoices', 'finance')).toBe(true);
    expect(canRoleAccess('/reports', 'finance')).toBe(true);
    expect(canRoleAccess('/calendar', 'finance')).toBe(false);
    expect(canRoleAccess('/register', 'finance')).toBe(false);
  });

  it('parent can access portal routes and is blocked from staff routes', () => {
    expect(canRoleAccess('/portal/home', 'parent')).toBe(true);
    expect(canRoleAccess('/portal/invoices', 'parent')).toBe(true);
    expect(canRoleAccess('/dashboard', 'parent')).toBe(false);
    expect(canRoleAccess('/students', 'parent')).toBe(false);
  });
});
