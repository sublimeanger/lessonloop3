/**
 * 19 — Make-ups, waitlist, leads, enrolment
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §19
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import { seedLead, supabaseDelete } from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('Make-up dashboard (/make-ups)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/make-ups');
    await assertNoErrorBoundary(page);
  });
});

test.describe('Leads (/leads)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/leads');
    await assertNoErrorBoundary(page);
  });

  test.fixme('seeded lead appears in list', async ({ page }) => {
    const testId = `lead_${Date.now()}`;
    const { leadId } = seedLead({ testId, contactName: `e2e_${testId} TestLead` });
    await goTo(page, '/leads');
    await page.waitForTimeout(2000);
    await assertNoErrorBoundary(page);
    supabaseDelete('leads', `id=eq.${leadId}`);
  });
});

test.describe('Enrolment waitlist (/waitlist)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/waitlist');
    await assertNoErrorBoundary(page);
  });
});

test.fixme('§19.3 — auto-match: open slot → match in waitlist', async () => {});
test.fixme('§19.3 — offer slot → notify-makeup-offer email sent', async () => {});
test.fixme('§19.3 — parent accept via URL param → status=accepted', async () => {});
test.fixme('§19.3 — admin confirm → lesson + credit consumed', async () => {});
test.fixme('§19.7 — drag lead to "contacted" → stage updated, activity logged', async () => {});
test.fixme('§19.7 — convert_lead RPC creates student + guardian rows', async () => {});
test.fixme('§19.7 — feature gate: leads hidden on trial plan', async () => {});
test.fixme('§19.10 — enrolment offer accept → convert_waitlist_to_student', async () => {});
test.fixme('§19.5 — credit_expiry cron voids credits past expires_at', async () => {});
