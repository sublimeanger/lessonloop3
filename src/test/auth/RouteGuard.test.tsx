/**
 * LL-AUTH-P0-01: Route Guard Tests
 * Tests role-based routing, auth redirection, and onboarding guards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RouteGuard, PublicRoute } from '@/components/auth/RouteGuard';
import {
  mockOwnerAuth,
  mockAdminAuth,
  mockTeacherAuth,
  mockFinanceAuth,
  mockParentAuth,
  mockUnauthenticated,
  mockOnboardingIncomplete,
  mockLoadingAuth,
} from '../helpers/mockAuth';
import { createMockOrgContext } from '../helpers/mockOrg';

let currentAuth = mockOwnerAuth();
let currentOrg = createMockOrgContext('owner');

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => currentAuth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/contexts/OrgContext', () => ({
  useOrg: () => currentOrg,
  OrgProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

function TestApp({ path }: { path: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<div data-testid="login">Login Page</div>} />
        <Route path="/login" element={<div data-testid="login">Login Page</div>} />
        <Route path="/onboarding" element={<div data-testid="onboarding">Onboarding Page</div>} />
        <Route path="/dashboard" element={
          <RouteGuard allowedRoles={['owner', 'admin', 'teacher', 'finance']}>
            <div data-testid="dashboard">Dashboard Page</div>
          </RouteGuard>
        } />
        <Route path="/calendar" element={
          <RouteGuard allowedRoles={['owner', 'admin', 'teacher']}>
            <div data-testid="calendar">Calendar Page</div>
          </RouteGuard>
        } />
        <Route path="/invoices" element={
          <RouteGuard allowedRoles={['owner', 'admin', 'finance']}>
            <div data-testid="invoices">Invoices Page</div>
          </RouteGuard>
        } />
        <Route path="/teachers" element={
          <RouteGuard allowedRoles={['owner', 'admin']}>
            <div data-testid="teachers">Teachers Page</div>
          </RouteGuard>
        } />
        <Route path="/portal/home" element={
          <RouteGuard allowedRoles={['parent']}>
            <div data-testid="portal-home">Portal Home</div>
          </RouteGuard>
        } />
      </Routes>
    </MemoryRouter>
  );
}

function PublicTestApp({ path }: { path: string }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={
          <PublicRoute><div data-testid="login">Login Page</div></PublicRoute>
        } />
        <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard Page</div>} />
        <Route path="/onboarding" element={<div data-testid="onboarding">Onboarding Page</div>} />
        <Route path="/portal/home" element={<div data-testid="portal-home">Portal Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function hasTestId(container: HTMLElement, id: string): boolean {
  return container.querySelector(`[data-testid="${id}"]`) !== null;
}

describe('LL-AUTH-P0-01: RouteGuard', () => {
  beforeEach(() => {
    currentAuth = mockOwnerAuth();
    currentOrg = createMockOrgContext('owner');
  });

  describe('Authentication redirects', () => {
    it('redirects unauthenticated users to /auth', () => {
      currentAuth = mockUnauthenticated();
      const { container } = render(<TestApp path="/dashboard" />);
      expect(hasTestId(container, 'login')).toBe(true);
    });

    it('redirects onboarding-incomplete users to /onboarding', () => {
      currentAuth = mockOnboardingIncomplete();
      currentOrg = createMockOrgContext('owner');
      const { container } = render(<TestApp path="/dashboard" />);
      expect(hasTestId(container, 'onboarding')).toBe(true);
    });

    it('shows loading state while auth is initialising', () => {
      currentAuth = mockLoadingAuth();
      const { container } = render(<TestApp path="/dashboard" />);
      expect(container.textContent).toContain('Loading');
    });
  });

  describe('Role-based landing pages', () => {
    it('owner can access /dashboard', () => {
      currentAuth = mockOwnerAuth();
      currentOrg = createMockOrgContext('owner');
      const { container } = render(<TestApp path="/dashboard" />);
      expect(hasTestId(container, 'dashboard')).toBe(true);
    });

    it('admin can access /dashboard', () => {
      currentAuth = mockAdminAuth();
      currentOrg = createMockOrgContext('admin');
      const { container } = render(<TestApp path="/dashboard" />);
      expect(hasTestId(container, 'dashboard')).toBe(true);
    });

    it('teacher can access /dashboard', () => {
      currentAuth = mockTeacherAuth();
      currentOrg = createMockOrgContext('teacher');
      const { container } = render(<TestApp path="/dashboard" />);
      expect(hasTestId(container, 'dashboard')).toBe(true);
    });

    it('finance can access /dashboard', () => {
      currentAuth = mockFinanceAuth();
      currentOrg = createMockOrgContext('finance');
      const { container } = render(<TestApp path="/dashboard" />);
      expect(hasTestId(container, 'dashboard')).toBe(true);
    });
  });

  describe('Role-gated route enforcement', () => {
    it('finance cannot access /calendar', () => {
      currentAuth = mockFinanceAuth();
      currentOrg = createMockOrgContext('finance');
      const { container } = render(<TestApp path="/calendar" />);
      expect(hasTestId(container, 'dashboard')).toBe(true);
    });

    it('teacher cannot access /invoices', () => {
      currentAuth = mockTeacherAuth();
      currentOrg = createMockOrgContext('teacher');
      const { container } = render(<TestApp path="/invoices" />);
      expect(hasTestId(container, 'dashboard')).toBe(true);
    });

    it('teacher cannot access /teachers (admin-only)', () => {
      currentAuth = mockTeacherAuth();
      currentOrg = createMockOrgContext('teacher');
      const { container } = render(<TestApp path="/teachers" />);
      expect(hasTestId(container, 'dashboard')).toBe(true);
    });

    it('parent is redirected to /portal/home from staff routes', () => {
      currentAuth = mockParentAuth();
      currentOrg = createMockOrgContext('parent');
      const { container } = render(<TestApp path="/dashboard" />);
      expect(hasTestId(container, 'portal-home')).toBe(true);
    });

    it('owner can access /invoices', () => {
      currentAuth = mockOwnerAuth();
      currentOrg = createMockOrgContext('owner');
      const { container } = render(<TestApp path="/invoices" />);
      expect(hasTestId(container, 'invoices')).toBe(true);
    });

    it('parent can access /portal/home', () => {
      currentAuth = mockParentAuth();
      currentOrg = createMockOrgContext('parent');
      const { container } = render(<TestApp path="/portal/home" />);
      expect(hasTestId(container, 'portal-home')).toBe(true);
    });
  });

  describe('PublicRoute behaviour', () => {
    it('shows public page for unauthenticated users', () => {
      currentAuth = mockUnauthenticated();
      const { container } = render(<PublicTestApp path="/login" />);
      expect(hasTestId(container, 'login')).toBe(true);
    });

    it('redirects authenticated owner to /dashboard', () => {
      currentAuth = mockOwnerAuth();
      currentOrg = createMockOrgContext('owner');
      const { container } = render(<PublicTestApp path="/login" />);
      expect(hasTestId(container, 'dashboard')).toBe(true);
    });

    it('redirects authenticated parent to /portal/home', () => {
      currentAuth = mockParentAuth();
      currentOrg = createMockOrgContext('parent');
      const { container } = render(<PublicTestApp path="/login" />);
      expect(hasTestId(container, 'portal-home')).toBe(true);
    });

    it('redirects onboarding-incomplete user to /onboarding', () => {
      currentAuth = mockOnboardingIncomplete();
      currentOrg = createMockOrgContext('owner');
      const { container } = render(<PublicTestApp path="/login" />);
      expect(hasTestId(container, 'onboarding')).toBe(true);
    });
  });
});
