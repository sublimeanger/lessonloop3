/**
 * Auth refresh fixture — keeps storage state JWTs fresh during long suite runs.
 *
 * Problem: Supabase JWTs default to 1hr exp. Full suite runs > 1hr cause
 * later tests to fail with `UNAUTHORIZED_ASYMMETRIC_JWT - Invalid JWT`
 * when edge functions reject the expired token. Even ~9min parallel runs
 * stale tokens because workers pick up storage state files written near
 * the start of the run.
 *
 * Solution: Override Playwright's `storageState` fixture so the file is
 * refreshed every time a context loads it — i.e. before EACH test (in
 * test files using `test.use({ storageState: AUTH.x })`). Cheap when
 * fresh (decode JWT exp; if fresh, return immediately). Refresh via
 * `refresh_token` only when within 5min of expiry.
 */

import { test as base, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';

const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// supabase-js stores the session under `sb-<project_ref>-auth-token`.
// Derive from URL so the key tracks whichever project the run targets.
const PROJECT_REF = (() => {
  try {
    return new URL(SUPABASE_URL).hostname.split('.')[0];
  } catch {
    return 'xmrhmxizpslhtkibqyfy';
  }
})();
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

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
 * Idempotent — safe to call repeatedly. Cheap when fresh (<10ms).
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
    return session.access_token;
  }

  // Refresh
  const fresh = refreshSessionViaCurl(session.refresh_token);
  if (!fresh) {
    // eslint-disable-next-line no-console
    console.warn(`[auth-refresh] Failed to refresh ${storagePath} — test may 401`);
    return null;
  }

  const merged = { ...session, ...fresh };
  lsEntry.value = JSON.stringify(merged);
  fs.writeFileSync(storagePath, JSON.stringify(state, null, 2));

  return fresh.access_token;
}

const AUTH_DIR = path.resolve(process.cwd(), 'tests/e2e/.auth');
const ALL_ROLE_FILES = ['owner', 'admin', 'teacher', 'finance', 'parent', 'parent2'].map(
  (r) => path.join(AUTH_DIR, `${r}.json`)
);

/**
 * Refresh all known role storage states. Call from `test.beforeAll` in
 * every spec file. Idempotent + cheap when fresh.
 */
export function refreshAllStorageStates(): void {
  for (const f of ALL_ROLE_FILES) {
    try {
      refreshStorageStateIfStale(f);
    } catch {
      /* ignore — auth.setup.ts will create on first run */
    }
  }
}

/**
 * Read the latest session value from a storage state file and inject it
 * into the running page's localStorage. Used to push a refreshed JWT into
 * a context that was created earlier with a now-stale token (the file on
 * disk may have been refreshed in the meantime by `storageState` override
 * + `refreshStorageStateIfStale`, but the in-memory localStorage of the
 * running browser is not auto-resynced).
 *
 * No-op if the file doesn't exist, the localStorage entry is missing, or
 * the page has not yet navigated to an origin where localStorage is
 * accessible (page.evaluate failures swallowed).
 */
async function injectFreshSessionFromFile(
  page: Page,
  storagePath: string,
): Promise<void> {
  if (!fs.existsSync(storagePath)) return;
  let raw: string;
  try {
    raw = fs.readFileSync(storagePath, 'utf-8');
  } catch {
    return;
  }
  let state: any;
  try {
    state = JSON.parse(raw);
  } catch {
    return;
  }
  const lsEntry = state.origins?.[0]?.localStorage?.find(
    (kv: any) => kv.name === STORAGE_KEY,
  );
  if (!lsEntry?.value) return;

  try {
    await page.evaluate(
      ([key, val]) => {
        try {
          window.localStorage.setItem(key, val);
        } catch {
          /* ignore — about:blank or cross-origin */
        }
      },
      [lsEntry.name, lsEntry.value] as const,
    );
  } catch {
    /* page navigation race — caller will retry on next goto */
  }
}

/**
 * Playwright test extended with auto-refreshing storageState + JWT-injection
 * after first navigation.
 *
 * Two layers:
 *  1) `storageState` override — refresh the file on disk before the context
 *     reads it, so the initial localStorage population is fresh.
 *  2) `page` override — wrap `page.goto` so that, on first navigation, we
 *     re-read the (possibly newly-refreshed) file and overwrite the
 *     running browser's localStorage with the latest token. This handles
 *     the case where the JWT in a long-lived context goes stale because
 *     contexts can persist across tests within a worker, and the in-memory
 *     localStorage doesn't auto-resync just because the file does.
 *
 * Both are no-ops when storageState is not a file path (e.g. anonymous
 * tests) or when the JWT is still fresh (refreshStorageStateIfStale
 * short-circuits at >5min from expiry).
 */
export const test = base.extend<{}, {}>({
  storageState: async ({ storageState }, use) => {
    if (typeof storageState === 'string') {
      try {
        refreshStorageStateIfStale(storageState);
      } catch {
        /* ignore */
      }
    }
    await use(storageState);
  },

  page: async ({ page, storageState }, use) => {
    if (typeof storageState !== 'string') {
      await use(page);
      return;
    }
    const storagePath = storageState;
    const origGoto = page.goto.bind(page);
    let injected = false;
    page.goto = (async (url: any, opts?: any) => {
      const result = await origGoto(url, opts);
      if (!injected) {
        injected = true;
        try {
          // Refresh-on-disk first (idempotent if already done in storageState
          // fixture; covers the case where context is reused across tests).
          refreshStorageStateIfStale(storagePath);
          await injectFreshSessionFromFile(page, storagePath);
        } catch {
          /* ignore — never fail a test on auth refresh */
        }
      }
      return result;
    }) as typeof page.goto;
    await use(page);
  },
});

export { expect };
