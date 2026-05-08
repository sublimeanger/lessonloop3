/**
 * 26 — Parent portal (every page)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §26
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.parent);
  refreshStorageStateIfStale(AUTH.parent2);
});

const PORTAL_PAGES = [
  { path: '/portal/home', label: 'Home' },
  { path: '/portal/schedule', label: 'Schedule' },
  { path: '/portal/practice', label: 'Practice' },
  { path: '/portal/resources', label: 'Resources' },
  { path: '/portal/invoices', label: 'Invoices & Payments' },
  { path: '/portal/messages', label: 'Messages' },
  { path: '/portal/profile', label: 'Profile' },
];

test.describe('Parent portal — page loads', () => {
  test.use({ storageState: AUTH.parent });

  for (const p of PORTAL_PAGES) {
    test(`${p.label} (${p.path}) loads without error`, async ({ page }) => {
      await goTo(page, p.path);
      await assertNoErrorBoundary(page);
      await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 15_000 });
    });
  }
});

test.describe('Parent portal — login redirect', () => {
  test.use({ storageState: AUTH.parent });

  test('parent login → redirected to /portal/home', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/portal\/home/, { timeout: 15_000 });
  });
});

test.describe('Parent portal — child filter', () => {
  test.use({ storageState: AUTH.parent });

  test('home page renders for parent with child(ren)', async ({ page }) => {
    await goTo(page, '/portal/home');
    await assertNoErrorBoundary(page);
  });
});

test.describe('Parent portal — invoices', () => {
  test.use({ storageState: AUTH.parent });

  test('invoices page renders without currency-error boundary', async ({ page }) => {
    // This was a real production bug fixed 2026-05-08:
    // empty currency_code triggered RangeError → ErrorBoundary
    await goTo(page, '/portal/invoices');
    await page.waitForTimeout(3000);
    await assertNoErrorBoundary(page);
    // "Something went wrong" should NOT appear
    const errorBoundary = await page.getByText('Something went wrong').first().isVisible({ timeout: 2000 }).catch(() => false);
    expect(errorBoundary).toBe(false);
  });
});

// §26.9 parent pays full invoice via embedded drawer is end-to-end
// covered by 24-stripe.spec.ts §24.2/§24.3 — same backend flow:
// stripe-create-payment-intent → confirmTestPaymentIntent → webhook
// → payments row + status=paid. Here we add the parent-portal-side
// concerns (§26.7 practice log) that 24-stripe doesn't cover.

import {
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
  getOwnerUserId,
  getOrgId,
} from '../supabase-admin';

test.describe('§26.7 — Practice log', () => {
  const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
  const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';
  const E2E_PARENT_USER_ID = '85628488-f47f-4178-84f0-3425aad6e75e';

  test('parent inserts practice_logs row → updates practice_streaks (trigger)', async () => {
    const testId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Setup: a fresh student linked to the e2e parent's guardian.
    // The seed data has no student-guardian linkage for the e2e parent;
    // creating one here scopes to this test only.
    const student = supabaseInsert('students', {
      org_id: E2E_ORG_ID,
      first_name: `${testId}_student`,
      last_name: testId,
      status: 'active',
    });
    if (!student?.id) {
      throw new Error(`seedStudent failed: ${JSON.stringify(student)}`);
    }
    supabaseInsert('student_guardians', {
      org_id: E2E_ORG_ID,
      student_id: student.id,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      relationship: 'guardian', // enum: mother|father|guardian|other
      is_primary_payer: false,
    });

    try {
      // Insert a practice_logs row as the parent. The update_practice_streak
      // trigger should fire and create/update a practice_streaks row.
      const today = new Date().toISOString().slice(0, 10);
      const logRow = supabaseInsert('practice_logs', {
        org_id: E2E_ORG_ID,
        student_id: student.id,
        logged_by_user_id: E2E_PARENT_USER_ID,
        practice_date: today,
        duration_minutes: 30,
        notes: `${testId}_log_notes`,
      });
      expect(logRow?.id).toBeTruthy();

      // The log row exists with the expected fields.
      const logs = supabaseSelect(
        'practice_logs',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}&select=duration_minutes,practice_date,notes`,
      );
      expect(logs.length).toBe(1);
      expect(logs[0].duration_minutes).toBe(30);
      expect(logs[0].practice_date).toBe(today);
      expect(logs[0].notes).toBe(`${testId}_log_notes`);

      // The trigger should have created a practice_streaks row for the
      // student. current_streak should be 1 (single day's log starts a streak).
      const streaks = supabaseSelect(
        'practice_streaks',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}&select=current_streak,longest_streak,last_practice_date`,
      );
      expect(streaks.length).toBeGreaterThanOrEqual(1);
      expect(streaks[0].current_streak).toBeGreaterThanOrEqual(1);
      expect(streaks[0].last_practice_date).toBe(today);
    } finally {
      // Cleanup: streaks first, then logs, then linkage, then student.
      supabaseDelete(
        'practice_streaks',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete(
        'practice_logs',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete(
        'student_guardians',
        `org_id=eq.${E2E_ORG_ID}&student_id=eq.${student.id}`,
      );
      supabaseDelete('students', `org_id=eq.${E2E_ORG_ID}&id=eq.${student.id}`);
    }
  });
});

// Other §26 fixmes left for next session — most are UI-heavy (drawer
// confirmations, Stripe Elements iframe, native app NativePaymentNotice)
// or rely on data the e2e seed doesn't currently provide (multi-child
// parent for child filter, active continuation run, message threads).
// Backend-driven gap-fillers tracked: §26.4 makeup offer respond,
// §26.10 compose new thread + notify-internal-message, §26.12/§26.13
// continuation response (authed + public token).
