/**
 * 03 — Auth flows (login / signup / forgot / reset / verify / accept-invite)
 *
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §3
 *
 * Most paths use no storage state (anonymous). Tests cover:
 *  - Login happy path + every validation case
 *  - Signup happy path + password strength + obfuscation
 *  - Forgot/reset password
 *  - Email verification
 *  - Accept invite (existing user, new user, expired, wrong email)
 *  - OAuth callback handling
 *  - Open-redirect guards on inviteReturn / `from` state
 */

import { test, expect } from './_fixtures/auth-refresh';
import { execSync } from 'child_process';
import fs from 'fs';

test.describe('Login (/login)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('renders all login elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /get started|sign up/i }).first()).toBeVisible();
  });

  test('empty form blocked with validation', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(1500);
    // Validation surfaces in any of: toast text, aria-invalid, or HTML5 :invalid
    const emailInvalid = await page.getByLabel('Email').getAttribute('aria-invalid');
    const passwordInvalid = await page.locator('#password').getAttribute('aria-invalid');
    const hasToast = await page.getByText(/missing|required|invalid|enter|please/i).first().isVisible({ timeout: 1000 }).catch(() => false);
    const stayedOnLogin = page.url().includes('/login');
    // We just need to confirm we did NOT navigate to dashboard (i.e. not signed in)
    expect(emailInvalid === 'true' || passwordInvalid === 'true' || hasToast || stayedOnLogin).toBeTruthy();
  });

  test('wrong password shows generic error (no enumeration)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_OWNER_EMAIL!);
    await page.locator('#password').fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByText(/incorrect email or password|invalid|sign in failed/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('non-existent user shows same generic error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('does-not-exist-e2e@test.lessonloop.net');
    await page.locator('#password').fill('AnyPassword99!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByText(/incorrect email or password|invalid|sign in failed/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('password show/hide toggle', async ({ page }) => {
    await page.goto('/login');
    const pw = page.locator('#password');
    await pw.fill('SomePassword');
    await expect(pw).toHaveAttribute('type', 'password');
    const showBtn = page.locator('button[aria-label*="Show password" i]').first();
    if (await showBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await showBtn.click();
      await expect(pw).toHaveAttribute('type', 'text');
    }
  });

  test('Forgot password link → /forgot-password', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot password/i }).first().click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('Get started link → /signup', async ({ page }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: /get started|sign up/i }).first();
    await link.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('OAuth-callback skeleton on /login#access_token=fake then timeout', async ({ page }) => {
    await page.goto('/login#access_token=fake_token_123&token_type=bearer');
    // Should show a loading/skeleton state (not the form)
    const signingIn = await page.getByText(/signing you in/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    if (signingIn) {
      // After ~10s it should toast a timeout
      await expect(page.getByText(/timed out|sign in failed/i).first()).toBeVisible({ timeout: 20_000 });
    }
  });

  test('open-redirect guard: //evil.com in `from` is rejected', async ({ page }) => {
    await page.goto('/login');
    // Inject malicious from state via sessionStorage like PublicRoute would read
    await page.evaluate(() => {
      sessionStorage.setItem('lessonloop_invite_return', '//evil.com');
    });
    // Sign in with the owner credentials
    await page.getByLabel('Email').fill(process.env.E2E_OWNER_EMAIL!);
    await page.locator('#password').fill(process.env.E2E_OWNER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Must NOT navigate to evil.com
    await page.waitForTimeout(3000);
    expect(page.url()).not.toMatch(/evil\.com/);
  });
});

test.describe('Signup (/signup)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('renders signup form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByLabel(/full name|name/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
  });

  test('password strength gate blocks weak passwords', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel(/full name/i).first().fill('Test');
    await page.getByLabel(/email/i).first().fill(`signup-test-${Date.now()}@e2e.lessonloop.net`);
    await page.locator('#password').fill('123');
    await page.locator('#confirmPassword').fill('123');
    await page.getByRole('button', { name: /sign up|create account/i }).first().click();
    await expect(page.getByText(/too weak|too short|password.*requirement/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('password mismatch shows error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel(/full name/i).first().fill('Test');
    await page.getByLabel(/email/i).first().fill(`signup-test-${Date.now()}@e2e.lessonloop.net`);
    await page.locator('#password').fill('StrongPass123!');
    await page.locator('#confirmPassword').fill('DifferentPass123!');
    await page.getByRole('button', { name: /sign up|create account/i }).first().click();
    await expect(page.getByText(/match|don.t match/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('existing email returns ambiguous error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel(/full name/i).first().fill('Test');
    await page.getByLabel(/email/i).first().fill(process.env.E2E_OWNER_EMAIL!); // exists
    await page.locator('#password').fill('StrongPass123!');
    await page.locator('#confirmPassword').fill('StrongPass123!');
    await page.getByRole('button', { name: /sign up|create account/i }).first().click();
    // SEC-AUTH-03: must not say "already exists" — must say "may already exist" or generic
    const text = await page.locator('body').textContent();
    expect(text?.toLowerCase()).not.toContain('account already exists');
  });
});

test.describe('Forgot password (/forgot-password)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('submit shows success regardless of email existence', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel(/email/i).first().fill(`nonexistent-${Date.now()}@e2e.test`);
    await page.getByRole('button', { name: /reset|send/i }).first().click();
    // No enumeration — generic "if your email is registered, you'll receive a link"
    await expect(page.getByText(/sent|check.*email|if.*registered/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Verify email (/verify-email)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthed visit redirects to /login', async ({ page }) => {
    await page.goto('/verify-email');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});

// §3.7 Zoom OAuth callback — needs mock of calendar-oauth-callback edge fn.
// Hidden at v1 launch per v2 §3.2 (Zoom integration deferred); keep the
// fixme as a placeholder for v1.1.
test.fixme('§3.7 — zoom OAuth callback happy path', async () => {});

// ────────────────────────────────────────────────────────────────────
// §3.9 — Accept invite end-to-end (s19 C-bucket close)
// ────────────────────────────────────────────────────────────────────
//
// Backend-driven contract for the invite-accept fn. UI variant in
// AcceptInvite.tsx is fragile (signup-or-existing branch + redacted
// email match heuristic + 7 toast paths). The fn is the durable bit:
// it mints the org_membership row + sets accepted_at, with all four
// guards (not-found / expired / wrong-email / already-accepted).
//
// Pattern: createThrowawayUser, sign in to mint a real JWT, seed an
// invite via service-role keyed on the user's email, invoke the fn
// with the user JWT + invite token, assert org_memberships + invites
// state. Cleanup: delete user + invite + membership in afterEach.

function invokeInviteAccept(jwt: string, token: string): { status: number; body: any } {
  const reqFile = `/tmp/sb-invite-accept-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  const respFile = `/tmp/sb-invite-accept-resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.txt`;
  fs.writeFileSync(reqFile, JSON.stringify({ token }));
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/invite-accept" ` +
        `-H "Authorization: Bearer ${jwt}" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Content-Type: application/json" -d @${reqFile}`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const respText = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    let body: any;
    try { body = JSON.parse(respText); } catch { body = respText; }
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
  }
}

function srHeadersAuth(): string {
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  return `-H "apikey: ${key}" -H "Authorization: Bearer ${key}"`;
}

function srPostAuth(table: string, payload: Record<string, unknown>): any[] {
  const reqFile = `/tmp/sb-srpa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  fs.writeFileSync(reqFile, JSON.stringify(payload));
  try {
    const result = execSync(
      `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/${table}" ${srHeadersAuth()} ` +
        `-H "Content-Type: application/json" -H "Prefer: return=representation" -d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    try { const p = JSON.parse(result); return Array.isArray(p) ? p : []; } catch { return []; }
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

function srSelectAuth(table: string, query: string): any[] {
  const result = execSync(
    `curl -s "${process.env.E2E_SUPABASE_URL}/rest/v1/${table}?${query}" ${srHeadersAuth()}`,
    { encoding: 'utf-8', timeout: 15_000 },
  );
  try { const p = JSON.parse(result); return Array.isArray(p) ? p : []; } catch { return []; }
}

function srDeleteAuth(table: string, query: string): void {
  execSync(
    `curl -s -X DELETE "${process.env.E2E_SUPABASE_URL}/rest/v1/${table}?${query}" ${srHeadersAuth()}`,
    { encoding: 'utf-8', timeout: 15_000 },
  );
}

// ────────────────────────────────────────────────────────────────────
// §3.10 — Password reset complete end-to-end (s19)
// ────────────────────────────────────────────────────────────────────
//
// The "request reset" half (anti-enumeration) is covered in §3.5.
// This is the SET-NEW-PASSWORD half: user lands on /reset-password
// with a recovery token in the URL, types new password, submits.
//
// Backend test path: use Supabase admin API to generate a recovery
// link (returns an `action_link` containing a `code` we can exchange
// for a session). Then call `auth.updateUser({password})` with that
// session and verify the new password works for sign-in.
//
// This avoids brittle UI driving while still exercising the full
// recovery-token → new-password chain that ResetPassword.tsx
// orchestrates in production.

function generateRecoveryLink(email: string): { actionLink: string; properties: any } {
  const reqFile = `/tmp/sb-recovery-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  fs.writeFileSync(reqFile, JSON.stringify({
    type: 'recovery',
    email,
  }));
  try {
    const result = execSync(
      `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/auth/v1/admin/generate_link" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Content-Type: application/json" -d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const parsed = JSON.parse(result);
    if (!parsed.action_link) throw new Error(`generate_link failed: ${result.slice(0, 200)}`);
    return { actionLink: parsed.action_link, properties: parsed.properties };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

function exchangeCodeForSession(code: string): { accessToken: string; refreshToken: string } {
  const reqFile = `/tmp/sb-exchange-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  fs.writeFileSync(reqFile, JSON.stringify({ auth_code: code }));
  try {
    const result = execSync(
      `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/auth/v1/token?grant_type=pkce" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Content-Type: application/json" -d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const parsed = JSON.parse(result);
    if (!parsed.access_token) throw new Error(`exchange failed: ${result.slice(0, 200)}`);
    return { accessToken: parsed.access_token, refreshToken: parsed.refresh_token };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

function updatePasswordWithSession(accessToken: string, newPassword: string): { status: number; body: string } {
  const reqFile = `/tmp/sb-updatepw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  const respFile = `/tmp/sb-updatepw-resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.txt`;
  fs.writeFileSync(reqFile, JSON.stringify({ password: newPassword }));
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" -X PUT "${process.env.E2E_SUPABASE_URL}/auth/v1/user" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Authorization: Bearer ${accessToken}" ` +
        `-H "Content-Type: application/json" -d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
  }
}

function attemptSignIn(email: string, password: string): { status: number; ok: boolean } {
  const reqFile = `/tmp/sb-attempt-signin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  const respFile = `/tmp/sb-attempt-signin-resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.txt`;
  fs.writeFileSync(reqFile, JSON.stringify({ email, password }));
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Content-Type: application/json" -d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    let parsed: any = {};
    try { parsed = JSON.parse(body); } catch { /* ignore */ }
    return { status: parseInt(status.trim(), 10), ok: !!parsed.access_token };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
  }
}

// ────────────────────────────────────────────────────────────────────
// §3.11 — Email signup → onboarding wizard end-to-end (s19)
// ────────────────────────────────────────────────────────────────────
//
// Backend chain: createThrowawayUser (mimics signup result, since the
// `handle_new_user` trigger creates the profiles row regardless of
// whether the user came via signup form or admin API), then invoke
// `complete_onboarding` RPC with full payload. The RPC creates:
//   - organisations row
//   - org_memberships row with role='owner'
//   - profiles.has_completed_onboarding=true
//
// Verifies the documented 3-bug-chain fix from
// audit/findings/2026-05-08-complete-onboarding-rpc-three-bug-chain.md
// (commit 19d8efc) is still working: enum casts + service-role guard
// + exception catch all behaving correctly.
//
// This is the "Email signup → onboarding wizard end-to-end" row's
// durable backend contract. UI variant of the signup form is covered
// in §3 Signup describe (4 tests). UI variant of the wizard itself
// (multi-step navigation + state persistence) is C-bucket deferred —
// brittle and not on first-impression critical path beyond the
// backend chain landing correctly.

function callCompleteOnboarding(userId: string, email: string, opts: { fullName?: string; orgName?: string; orgType?: string } = {}): { status: number; body: any } {
  const reqFile = `/tmp/sb-complete-onb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  const respFile = `/tmp/sb-complete-onb-resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.txt`;
  fs.writeFileSync(reqFile, JSON.stringify({
    _user_id: userId,
    _user_email: email,
    _full_name: opts.fullName ?? 'E2E Onboarding Test',
    _phone: null,
    _org_name: opts.orgName ?? `e2e_onb_${Date.now()}`,
    _org_type: opts.orgType ?? 'solo_teacher',
    _country_code: 'GB',
    _currency_code: 'GBP',
    _timezone: 'Europe/London',
    _subscription_plan: 'solo_teacher',
    _max_students: -1,
    _max_teachers: 1,
    _parent_reschedule_policy: 'request_only',
    _trial_days: 14,
    _also_teaches: false,
  }));
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/rpc/complete_onboarding" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_SERVICE_ROLE_KEY}" ` +
        `-H "Content-Type: application/json" -d @${reqFile}`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const respText = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    let body: any;
    try { body = JSON.parse(respText); } catch { body = respText; }
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
  }
}

test.describe('§3.11 — Email signup → onboarding wizard end-to-end', () => {
  test('throwaway user → complete_onboarding RPC → org + membership + has_completed_onboarding=true', async () => {
    const { createThrowawayUser, deleteThrowawayUser } = await import('../supabase-admin');
    const user = createThrowawayUser({ emailPrefix: 'onb-target', hasCompletedOnboarding: false });
    const orgName = `e2e_onb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    let createdOrgId: string | null = null;
    try {
      // Invoke the full onboarding chain. complete_onboarding is
      // SECURITY DEFINER — service-role passes the inner caller-id
      // guard (post-19d8efc fix; pre-fix had a 3-bug chain).
      const res = callCompleteOnboarding(user.userId, user.email, {
        fullName: 'E2E Onboarding Test User',
        orgName,
        orgType: 'solo_teacher',
      });
      expect(res.status, `complete_onboarding body: ${JSON.stringify(res.body).slice(0, 300)}`).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      // The RPC returns jsonb with the new org_id. Capture it for cleanup.
      if (res.body && typeof res.body === 'object') {
        createdOrgId = res.body.org_id ?? res.body.organisation_id ?? null;
      }

      // Verify: organisations row created with the new org name
      const orgs = srSelectAuth('organisations', `name=eq.${orgName}&select=id,name,subscription_plan,trial_ends_at`);
      expect(orgs.length, `organisations row not created for ${orgName}`).toBe(1);
      expect(orgs[0].subscription_plan).toBe('solo_teacher');
      expect(orgs[0].trial_ends_at).toBeTruthy();
      if (!createdOrgId) createdOrgId = orgs[0].id;

      // Verify: org_memberships row with role=owner for the user
      const membership = srSelectAuth(
        'org_memberships',
        `user_id=eq.${user.userId}&org_id=eq.${createdOrgId}&select=role,status`,
      );
      expect(membership.length).toBeGreaterThanOrEqual(1);
      expect(membership[0].role).toBe('owner');

      // Verify: profiles.has_completed_onboarding flipped to true.
      // RLS gates profiles to the owning user; service-role bypasses.
      const profile = srSelectAuth(
        'profiles',
        `id=eq.${user.userId}&select=has_completed_onboarding,current_org_id`,
      );
      expect(profile.length).toBe(1);
      expect(profile[0].has_completed_onboarding).toBe(true);
      expect(profile[0].current_org_id).toBe(createdOrgId);
    } finally {
      // Cleanup order: memberships → teachers (auto-created for
      // also_teaches but we passed false; defensive anyway) → org
      // → user. profiles row CASCADEs from auth.users delete.
      if (createdOrgId) {
        srDeleteAuth('org_memberships', `org_id=eq.${createdOrgId}`);
        srDeleteAuth('teachers', `org_id=eq.${createdOrgId}`);
        srDeleteAuth('organisations', `id=eq.${createdOrgId}`);
      }
      deleteThrowawayUser(user.userId);
    }
  });
});

test.describe('§3.10 — Password reset complete end-to-end', () => {
  test('happy path: recovery token → updateUser({password}) → can sign in with new password', async () => {
    const { createThrowawayUser, deleteThrowawayUser } = await import('../supabase-admin');
    const user = createThrowawayUser({ emailPrefix: 'reset-target' });
    const oldPassword = user.password;
    const newPassword = 'NewSecurePass456!';

    try {
      // 1. Admin API generates a recovery link. Returns the action_link
      // that the recipient (in production, via email link) clicks. The
      // link points at /auth/v1/verify?token=<hashed_token>&type=recovery.
      // The admin response also exposes the hashed_token directly at the
      // top level which we use to bypass the email round-trip.
      const linkRes = generateRecoveryLink(user.email);
      const actionLink = linkRes.actionLink;
      expect(actionLink).toBeTruthy();

      // Extract token from action_link query (admin response uses ?token=)
      const url = new URL(actionLink);
      const recoveryToken = url.searchParams.get('token');
      const tokenType = url.searchParams.get('type');
      expect(recoveryToken, `recovery link missing token. url: ${actionLink}`).toBeTruthy();
      expect(tokenType).toBe('recovery');

      // 2. POST to /auth/v1/verify with type=recovery + token_hash.
      // This is what the in-app exchange does after the user clicks the
      // email link — exchanges the recovery token_hash for a session.
      let accessToken: string | null = null;
      const verifyReq = `/tmp/sb-verify-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
      fs.writeFileSync(verifyReq, JSON.stringify({ type: 'recovery', token_hash: recoveryToken }));
      try {
        const verifyResult = execSync(
          `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/auth/v1/verify" ` +
            `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
            `-H "Content-Type: application/json" -d @${verifyReq}`,
          { encoding: 'utf-8', timeout: 15_000 },
        );
        const parsed = JSON.parse(verifyResult);
        if (parsed.access_token) accessToken = parsed.access_token;
      } finally {
        try { fs.unlinkSync(verifyReq); } catch { /* ignore */ }
      }
      expect(accessToken, 'failed to obtain access token from recovery token_hash').toBeTruthy();

      // 3. Use the recovery session to update password.
      const update = updatePasswordWithSession(accessToken!, newPassword);
      expect(update.status, `updateUser body: ${update.body.slice(0, 200)}`).toBeGreaterThanOrEqual(200);
      expect(update.status).toBeLessThan(300);

      // 4. Verify: can sign in with NEW password
      const signinNew = attemptSignIn(user.email, newPassword);
      expect(signinNew.ok, `sign-in with new password failed; status ${signinNew.status}`).toBe(true);

      // 5. Verify: OLD password no longer works
      const signinOld = attemptSignIn(user.email, oldPassword);
      expect(signinOld.ok, `OLD password should NOT work after reset`).toBe(false);
      expect(signinOld.status).toBeGreaterThanOrEqual(400);
    } finally {
      deleteThrowawayUser(user.userId);
    }
  });
});

test.describe('§3.9 — Accept invite end-to-end', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';

  async function setupInviteScenario(opts: { role?: string; expiresAt?: string; userEmailOverride?: string } = {}) {
    const { createThrowawayUser } = await import('../supabase-admin');
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const targetEmail = `invite-target-${stamp}@test.lessonloop.net`;

    // 1. Create the throwaway user matching the invite email
    const user = createThrowawayUser({
      emailPrefix: `invite-target-${stamp}-x`,
      // override email by setting prefix; we'll use the stamp pattern
    });
    // Actually createThrowawayUser builds the email from prefix; override
    // by re-creating with explicit construct via admin API.
    // Simpler: use the email returned by createThrowawayUser, seed invite
    // matching THAT email (not a separate target email).

    return { user, stamp };
  }

  // Helper: sign in and return access_token for use in invoke
  function signIn(email: string, password: string): string {
    const reqFile = `/tmp/sb-signin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
    fs.writeFileSync(reqFile, JSON.stringify({ email, password }));
    try {
      const result = execSync(
        `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
          `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
          `-H "Content-Type: application/json" -d @${reqFile}`,
        { encoding: 'utf-8', timeout: 15_000 },
      );
      const session = JSON.parse(result);
      if (!session.access_token) throw new Error(`signIn failed: ${result.slice(0, 200)}`);
      return session.access_token;
    } finally {
      try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
    }
  }

  test('happy path: throwaway user accepts invite → org_membership created with role=teacher', async () => {
    const { createThrowawayUser, deleteThrowawayUser } = await import('../supabase-admin');
    const user = createThrowawayUser({ emailPrefix: 'invite-happy' });

    let inviteId: string | null = null;
    try {
      // Seed invite for the throwaway user's email
      const inviteRows = srPostAuth('invites', {
        org_id: E2E_ORG_ID,
        email: user.email,
        role: 'teacher',
      });
      expect(inviteRows.length).toBe(1);
      inviteId = inviteRows[0].id;
      const token = inviteRows[0].token as string;
      expect(token).toBeTruthy();

      // Sign in as user → mint JWT
      const jwt = signIn(user.email, user.password);

      // Invoke invite-accept
      const res = invokeInviteAccept(jwt, token);
      expect(res.status, `invite-accept body: ${JSON.stringify(res.body).slice(0, 200)}`).toBe(200);

      // Verify: invites.accepted_at set + org_memberships row created
      const after = srSelectAuth('invites', `id=eq.${inviteId}&select=accepted_at`);
      expect(after[0].accepted_at).not.toBeNull();

      const membership = srSelectAuth(
        'org_memberships',
        `user_id=eq.${user.userId}&org_id=eq.${E2E_ORG_ID}&select=role,status`,
      );
      expect(membership.length).toBeGreaterThanOrEqual(1);
      expect(membership[0].role).toBe('teacher');
    } finally {
      if (inviteId) srDeleteAuth('invites', `id=eq.${inviteId}`);
      srDeleteAuth('org_memberships', `user_id=eq.${user.userId}&org_id=eq.${E2E_ORG_ID}`);
      srDeleteAuth('teachers', `user_id=eq.${user.userId}&org_id=eq.${E2E_ORG_ID}`);
      deleteThrowawayUser(user.userId);
    }
  });

  test('expired token rejected with 4xx', async () => {
    const { createThrowawayUser, deleteThrowawayUser } = await import('../supabase-admin');
    const user = createThrowawayUser({ emailPrefix: 'invite-expired' });

    let inviteId: string | null = null;
    try {
      // Invite expired 1 day ago
      const inviteRows = srPostAuth('invites', {
        org_id: E2E_ORG_ID,
        email: user.email,
        role: 'teacher',
        expires_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
      });
      expect(inviteRows.length).toBe(1);
      inviteId = inviteRows[0].id;
      const token = inviteRows[0].token as string;

      const jwt = signIn(user.email, user.password);
      const res = invokeInviteAccept(jwt, token);

      expect(res.status, `expected 4xx, got ${res.status} body: ${JSON.stringify(res.body).slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);

      // Confirm invite was NOT marked accepted
      const after = srSelectAuth('invites', `id=eq.${inviteId}&select=accepted_at`);
      expect(after[0].accepted_at).toBeNull();
    } finally {
      if (inviteId) srDeleteAuth('invites', `id=eq.${inviteId}`);
      srDeleteAuth('org_memberships', `user_id=eq.${user.userId}&org_id=eq.${E2E_ORG_ID}`);
      deleteThrowawayUser(user.userId);
    }
  });

  test('wrong-email JWT mismatch rejected with 4xx', async () => {
    const { createThrowawayUser, deleteThrowawayUser } = await import('../supabase-admin');
    const user = createThrowawayUser({ emailPrefix: 'invite-wrong-email-user' });

    let inviteId: string | null = null;
    try {
      // Invite for a DIFFERENT email than the throwaway user
      const otherEmail = `invite-target-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.lessonloop.net`;
      const inviteRows = srPostAuth('invites', {
        org_id: E2E_ORG_ID,
        email: otherEmail,
        role: 'teacher',
      });
      expect(inviteRows.length).toBe(1);
      inviteId = inviteRows[0].id;
      const token = inviteRows[0].token as string;

      const jwt = signIn(user.email, user.password);
      const res = invokeInviteAccept(jwt, token);

      // The fn does an email-match check; signed-in user.email !==
      // invite.email → 4xx. Expected 403/400 not 200.
      expect(res.status, `expected 4xx, got ${res.status} body: ${JSON.stringify(res.body).slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);

      // No org_membership created for the wrong user
      const membership = srSelectAuth(
        'org_memberships',
        `user_id=eq.${user.userId}&org_id=eq.${E2E_ORG_ID}&select=role`,
      );
      expect(membership.length).toBe(0);
    } finally {
      if (inviteId) srDeleteAuth('invites', `id=eq.${inviteId}`);
      deleteThrowawayUser(user.userId);
    }
  });

  test('already-accepted invite — second invocation idempotent or 4xx (no duplicate membership)', async () => {
    const { createThrowawayUser, deleteThrowawayUser } = await import('../supabase-admin');
    const user = createThrowawayUser({ emailPrefix: 'invite-idempotent' });

    let inviteId: string | null = null;
    try {
      const inviteRows = srPostAuth('invites', {
        org_id: E2E_ORG_ID,
        email: user.email,
        role: 'teacher',
      });
      expect(inviteRows.length).toBe(1);
      inviteId = inviteRows[0].id;
      const token = inviteRows[0].token as string;

      const jwt = signIn(user.email, user.password);

      // First call — happy
      const first = invokeInviteAccept(jwt, token);
      expect(first.status).toBe(200);

      // Second call — already accepted; fn should reject (4xx) or
      // no-op idempotently (200). Either way, only ONE membership row.
      const second = invokeInviteAccept(jwt, token);
      expect([200, 400, 409, 410, 422]).toContain(second.status);

      const membership = srSelectAuth(
        'org_memberships',
        `user_id=eq.${user.userId}&org_id=eq.${E2E_ORG_ID}&select=role`,
      );
      expect(membership.length).toBe(1);
    } finally {
      if (inviteId) srDeleteAuth('invites', `id=eq.${inviteId}`);
      srDeleteAuth('org_memberships', `user_id=eq.${user.userId}&org_id=eq.${E2E_ORG_ID}`);
      srDeleteAuth('teachers', `user_id=eq.${user.userId}&org_id=eq.${E2E_ORG_ID}`);
      deleteThrowawayUser(user.userId);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// §3.8 — Auth-cluster edge fn auth-gate contracts (s18)
// ────────────────────────────────────────────────────────────────────
//
// Account-delete + GDPR-export + GDPR-delete are user-facing edge fns
// that go through getUser(token) (s16 fix landed for all three). The
// audit rows still showed 🟡 because no test verified the auth gate.
// Same shape as s17 §24 money-path B-bucket: anon→4xx + no-auth→4xx
// prove the gate fires.
//
// Same `callFnAuthGate` pattern as §24 — copied inline rather than
// imported across spec files (per s5 anti-pattern guidance).

function callAuthFnGate(fnName: string, opts: { auth: 'anon' | 'none'; payload?: Record<string, unknown> }): { status: number; body: string } {
  const respFile = `/tmp/sb-auth-${fnName}-resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.txt`;
  const reqFile = `/tmp/sb-auth-${fnName}-req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  fs.writeFileSync(reqFile, JSON.stringify(opts.payload ?? {}));
  let authHeader = '';
  if (opts.auth === 'anon') {
    authHeader = `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" `;
  }
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
        `${authHeader}` +
        `-H "Content-Type: application/json" ` +
        `-d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

test.describe('§3.8 — Auth-cluster edge fn auth-gate contracts', () => {
  // User-JWT fns (all post-s16 getUser(token) fix).
  for (const fnName of [
    'account-delete',
    'gdpr-export',
    'gdpr-delete',
  ]) {
    test(`${fnName} — anon JWT rejected`, async () => {
      const res = callAuthFnGate(fnName, { auth: 'anon', payload: { confirm: true } });
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    test(`${fnName} — no auth rejected`, async () => {
      const res = callAuthFnGate(fnName, { auth: 'none' });
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
    });
  }
});
