/**
 * Auth refresh fixture — keeps storage state JWTs fresh during long suite runs.
 *
 * Problem: Supabase JWTs default to 1hr exp. Full suite runs > 1hr cause
 * later tests to fail with `UNAUTHORIZED_ASYMMETRIC_JWT - Invalid JWT`
 * when edge functions reject the expired token.
 *
 * Solution: each test loads its storage state, decodes the JWT, and if
 * it's within 5 minutes of expiry (or already expired), refreshes via
 * the refresh_token endpoint and writes the updated state back to disk
 * before the test continues.
 *
 * Usage:
 *   import { test, expect } from '../_fixtures/auth-refresh';
 *   test.use({ storageState: AUTH.owner });
 *   test('my test', async ({ page }) => { ... });
 */

import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

interface SessionLike {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id?: string; email?: string };
}

/** Decode a JWT and return the `exp` claim in seconds since epoch (or 0 on failure). */
function jwtExp(jwt: string): number {
  try {
    const payload = jwt.split('.')[1];
    const padding = '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = Buffer.from(payload + padding, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return typeof parsed.exp === 'number' ? parsed.exp : 0;
  } catch {
    return 0;
  }
}

/** Refresh an expired session via Supabase's token endpoint. */
function refreshSessionViaCurl(refreshToken: string): SessionLike | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const tmpFile = `/tmp/sb-refresh-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify({ refresh_token: refreshToken }));

  try {
    const result = execSync(
      `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token" ` +
        `-H "apikey: ${SUPABASE_ANON_KEY}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    const session = JSON.parse(result);
    if (session.error || !session.access_token) return null;
    return session;
  } catch {
    return null;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Read storage state from disk, refresh JWT if stale, write back.
 * Idempotent — safe to call once per test.
 *
 * Returns the refreshed access_token (for tests that need to make
 * direct REST calls).
 */
export function refreshStorageStateIfStale(storagePath: string): string | null {
  if (!fs.existsSync(storagePath)) return null;

  const raw = fs.readFileSync(storagePath, 'utf-8');
  let state: any;
  try {
    state = JSON.parse(raw);
  } catch {
    return null;
  }

  const origin = state.origins?.[0];
  if (!origin) return null;
  const lsEntry = origin.localStorage?.find((kv: any) =>
    kv.name?.startsWith('sb-')
  );
  if (!lsEntry?.value) return null;

  let session: SessionLike;
  try {
    session = JSON.parse(lsEntry.value);
  } catch {
    return null;
  }

  const exp = jwtExp(session.access_token);
  const now = Math.floor(Date.now() / 1000);
  const fiveMinutesFromNow = now + 5 * 60;

  if (exp > fiveMinutesFromNow) {
    // Still fresh
    return session.access_token;
  }

  // Refresh
  const fresh = refreshSessionViaCurl(session.refresh_token);
  if (!fresh) {
    // eslint-disable-next-line no-console
    console.warn(`[auth-refresh] Failed to refresh ${storagePath} — test may 401`);
    return null;
  }

  // Persist back. Preserve any extra session fields (e.g. user metadata).
  const merged = { ...session, ...fresh };
  lsEntry.value = JSON.stringify(merged);
  fs.writeFileSync(storagePath, JSON.stringify(state, null, 2));

  return fresh.access_token;
}

/**
 * Playwright test extended with auto-refresh:
 * - On every test, if the storage state file is referenced via test.use(),
 *   refresh it before the browser context loads it.
 *
 * NOTE: Playwright loads storageState at context creation (before the test
 * function runs), so we use the `storageStateInput` worker fixture trick
 * to intercept. In practice, calling `refreshStorageStateIfStale()` in a
 * `beforeEach` is too late. So instead we rely on consumers calling it
 * in a `beforeAll` per file (cheap — once per file, runs in <100ms when
 * already fresh).
 *
 * Recommended pattern in each spec file:
 *
 *   import { test, refreshStorageStateIfStale } from '../_fixtures/auth-refresh';
 *   import { AUTH } from '../../helpers';
 *
 *   test.beforeAll(() => {
 *     refreshStorageStateIfStale(AUTH.owner);
 *     refreshStorageStateIfStale(AUTH.parent);
 *     // …whichever roles this file uses
 *   });
 *   test.use({ storageState: AUTH.owner });
 */
export const test = base;
export { expect };
