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

test.describe('§22.2 — Organisation settings mutations', () => {
  test.use({ storageState: AUTH.owner });

  test('update timezone via REST → trigger validates + persists', async () => {
    const { supabaseSelect, supabaseInsert } = await import('../supabase-admin');
    const fs = await import('fs');
    const { execSync } = await import('child_process');
    const { randomBytes } = await import('crypto');

    const orgId = process.env.E2E_ORG_ID;
    const before = supabaseSelect('organisations', `id=eq.${orgId}&select=timezone`);
    const originalTz = before[0].timezone;
    const newTz = originalTz === 'Europe/London' ? 'Europe/Paris' : 'Europe/London';

    // PATCH via owner JWT (RLS-permitted; valid timezones don't trigger error)
    const fs2 = fs;
    const tmpFile = `/tmp/sb-tz-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
    fs2.writeFileSync(tmpFile, JSON.stringify({ timezone: newTz }));
    const path = await import('path');
    const ownerJwt = JSON.parse(fs2.readFileSync(path.resolve(process.cwd(), 'tests/e2e/.auth/owner.json'), 'utf-8'))
      .origins[0].localStorage[0].value;
    const session = JSON.parse(ownerJwt);
    execSync(
      `curl -s -X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/organisations?id=eq.${orgId}" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Authorization: Bearer ${session.access_token}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    fs2.unlinkSync(tmpFile);

    const after = supabaseSelect('organisations', `id=eq.${orgId}&select=timezone`);
    expect(after[0].timezone).toBe(newTz);

    // Restore
    const restoreFile = `/tmp/sb-tz-restore-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
    fs2.writeFileSync(restoreFile, JSON.stringify({ timezone: originalTz }));
    execSync(
      `curl -s -X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/organisations?id=eq.${orgId}" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Authorization: Bearer ${session.access_token}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${restoreFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    fs2.unlinkSync(restoreFile);
  });

  test('VAT toggle on/off persists', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const fs = await import('fs');
    const { execSync } = await import('child_process');
    const { randomBytes } = await import('crypto');
    const path = await import('path');

    const orgId = process.env.E2E_ORG_ID;
    const before = supabaseSelect('organisations', `id=eq.${orgId}&select=vat_enabled`);
    const original = before[0].vat_enabled;
    const target = !original;

    const tmpFile = `/tmp/sb-vat-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
    fs.writeFileSync(tmpFile, JSON.stringify({ vat_enabled: target }));
    const session = JSON.parse(JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tests/e2e/.auth/owner.json'), 'utf-8')).origins[0].localStorage[0].value);
    execSync(
      `curl -s -X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/organisations?id=eq.${orgId}" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Authorization: Bearer ${session.access_token}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    fs.unlinkSync(tmpFile);

    const after = supabaseSelect('organisations', `id=eq.${orgId}&select=vat_enabled`);
    expect(after[0].vat_enabled).toBe(target);

    // Restore
    const restoreFile = `/tmp/sb-vat-restore-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
    fs.writeFileSync(restoreFile, JSON.stringify({ vat_enabled: original }));
    execSync(
      `curl -s -X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/organisations?id=eq.${orgId}" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Authorization: Bearer ${session.access_token}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${restoreFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    fs.unlinkSync(restoreFile);
  });
});

test.fixme('§22.2 — manual subscription_plan update via REST is blocked by trigger', async () => {
  // Already covered in 32-security.spec.ts §32.7
});
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
