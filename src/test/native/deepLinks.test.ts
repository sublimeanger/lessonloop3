import { describe, it, expect, vi } from 'vitest';

// Mock the routes module so isAllowedDeepLink has a stable allowlist
vi.mock('@/config/routes', () => ({
  allRoutes: [
    { path: '/dashboard' },
    { path: '/portal/home' },
    { path: '/portal/schedule' },
    { path: '/auth/callback' },
    { path: '/accept-invite' },
    { path: '/respond/continuation' },
    { path: '/login' },
  ],
}));

vi.mock('../platform', () => ({
  platform: { isNative: false },
}));

import { isAllowedDeepLink } from '@/lib/native/deepLinks';

describe('isAllowedDeepLink — path-traversal protection', () => {
  it('rejects paths containing ".."', () => {
    expect(isAllowedDeepLink('/auth/callback/../admin')).toBe(false);
    expect(isAllowedDeepLink('/../etc/passwd')).toBe(false);
  });

  it('rejects javascript: scheme paths', () => {
    expect(isAllowedDeepLink('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: scheme paths', () => {
    expect(isAllowedDeepLink('data:text/html,<script>alert(1)</script>')).toBe(false);
  });
});

describe('isAllowedDeepLink — allowlist contract', () => {
  it('accepts known top-level paths', () => {
    expect(isAllowedDeepLink('/dashboard')).toBe(true);
    expect(isAllowedDeepLink('/login')).toBe(true);
  });

  it('accepts known nested paths under known prefix', () => {
    expect(isAllowedDeepLink('/auth/callback')).toBe(true);
    expect(isAllowedDeepLink('/portal/home')).toBe(true);
    expect(isAllowedDeepLink('/portal/schedule')).toBe(true);
    expect(isAllowedDeepLink('/respond/continuation')).toBe(true);
  });

  it('matches by top-level prefix (live caller passes urlObj.pathname so query is stripped)', () => {
    // Live caller does `urlObj.pathname` before passing to allowlist, so
    // queries never reach this function. The prefix-match logic is
    // forgiving by design — `/auth/anything` resolves under known `/auth`.
    expect(isAllowedDeepLink('/auth/callback')).toBe(true);
    expect(isAllowedDeepLink('/portal/anything-under-portal')).toBe(true);
  });

  it('rejects unknown top-level paths', () => {
    expect(isAllowedDeepLink('/admin-only-path')).toBe(false);
    expect(isAllowedDeepLink('/foo/bar')).toBe(false);
  });

  it('rejects empty path', () => {
    expect(isAllowedDeepLink('')).toBe(false);
  });
});
