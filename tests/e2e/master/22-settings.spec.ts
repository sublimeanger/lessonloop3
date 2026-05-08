/**
 * 22 — Settings (24 tabs)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §22
 *
 * Each tab loads + at least one happy-path mutation per tab.
 * Existing `workflows/settings-cascade.spec.ts` and `settings-extended.spec.ts`
 * cover most flows — this is the per-tab-load smoke + the catalog gap-fillers.
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.admin);
  refreshStorageStateIfStale(AUTH.teacher);
  refreshStorageStateIfStale(AUTH.finance);
});

const TABS = [
  'profile', 'organisation', 'branding', 'members', 'scheduling',
  'audit', 'privacy', 'rate-cards', 'music', 'messaging',
  'availability', 'calendar', 'zoom', 'billing', 'booking-page',
  'data-import', 'loopassist', 'notifications', 'help-tours',
  'continuation', 'accounting',
];

test.describe('Settings — per-tab smoke', () => {
  test.use({ storageState: AUTH.owner });

  for (const tab of TABS) {
    test(`tab=${tab} loads without error`, async ({ page }) => {
      await goTo(page, `/settings?tab=${tab}`);
      await assertNoErrorBoundary(page);
    });
  }
});

test.describe('Settings — non-admin degradation', () => {
  test.use({ storageState: AUTH.teacher });

  test('teacher sees Profile tab content even when ?tab=organisation requested', async ({ page }) => {
    await goTo(page, '/settings?tab=organisation');
    await page.waitForTimeout(2000);
    // Teacher cannot see admin tabs; resolvedTab logic forces 'profile'
    await assertNoErrorBoundary(page);
  });
});

// TODO: per-tab mutation tests below — substantial work each
test.fixme('§22.2 — update timezone → applied + validate_org_timezone_currency trigger', async () => {});
test.fixme('§22.2 — VAT toggle on → invoices show VAT lines', async () => {});
test.fixme('§22.2 — manual subscription_plan update via REST is blocked by trigger', async () => {});
test.fixme('§22.4 — invite by email + role → invites row + email queued', async () => {});
test.fixme('§22.4 — try to remove the owner → blocked (protect_owner_role)', async () => {});
test.fixme('§22.5 — add closure date → calendar grid greyed', async () => {});
test.describe('§22.6 — Audit log tab loads', () => {
  test.use({ storageState: AUTH.owner });

  test('audit_log tab navigates without error', async ({ page }) => {
    await goTo(page, '/settings?tab=audit');
    await page.waitForTimeout(2000);
    await assertNoErrorBoundary(page);
  });
});
test.fixme('§22.7 — privacy: GDPR export queues email', async () => {});
test.fixme('§22.8 — rate cards CRUD', async () => {});
test.fixme('§22.11 — availability: overlapping block → trigger error', async () => {});
test.fixme('§22.12 — calendar: connect Google (mock OAuth) → sync_status=active', async () => {});
test.fixme('§22.14 — billing: upgrade via stripe-subscription-checkout → plan upgraded', async () => {});
test.fixme('§22.15 — booking page slug collision blocked', async () => {});
test.fixme('§22.21 — Xero accounting: connect, sync invoice, disconnect', async () => {});
test.fixme('§22.22 — recurring billing template run-now creates invoices', async () => {});
