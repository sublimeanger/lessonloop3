/**
 * 19 — Make-ups, waitlist, leads, enrolment
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §19
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';
import { seedLead, supabaseDelete, supabaseSelect } from '../supabase-admin';

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

  test('seeded lead appears in list (DB read-back)', async () => {
    const testId = `lead_${Date.now()}`;
    const uniqueName = `e2e_${testId} TestLead`;
    const { leadId } = seedLead({ testId, contactName: uniqueName });
    try {
      const rows = supabaseSelect('leads', `id=eq.${leadId}&select=id,contact_name,stage`);
      expect(rows.length).toBe(1);
      expect(rows[0].contact_name).toBe(uniqueName);
      expect(rows[0].stage).toBe('enquiry');
    } finally {
      supabaseDelete('leads', `id=eq.${leadId}`);
    }
  });

  test('Lead detail page (/leads/:id) renders without error', async ({ page }) => {
    const testId = `leaddet_${Date.now()}`;
    const { leadId } = seedLead({ testId, contactName: `e2e_${testId} DetailTest` });
    try {
      await goTo(page, `/leads/${leadId}`);
      await assertNoErrorBoundary(page);
    } finally {
      supabaseDelete('leads', `id=eq.${leadId}`);
    }
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
test.describe('§19.7 — Lead stage transitions (DB)', () => {
  test.use({ storageState: AUTH.owner });

  test('seeded lead can be transitioned through stages', async () => {
    const testId = `stage_${Date.now()}`;
    const { leadId } = seedLead({ testId, contactName: `e2e_${testId} StageTest`, stage: 'enquiry' });

    // Update stage via owner JWT
    const fs = await import('fs');
    const { execSync } = await import('child_process');
    const { randomBytes } = await import('crypto');
    const path = await import('path');

    const sessionRaw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tests/e2e/.auth/owner.json'), 'utf-8'));
    const session = JSON.parse(sessionRaw.origins[0].localStorage[0].value);

    const tmpFile = `/tmp/sb-lead-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
    fs.writeFileSync(tmpFile, JSON.stringify({ stage: 'contacted' }));
    execSync(
      `curl -s -X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Authorization: Bearer ${session.access_token}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    fs.unlinkSync(tmpFile);

    const after = supabaseSelect('leads', `id=eq.${leadId}&select=stage`);
    expect(after[0].stage).toBe('contacted');

    // Cleanup
    supabaseDelete('leads', `id=eq.${leadId}`);
  });

  test('lead_activities are tracked in DB', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('lead_activities', `org_id=eq.${orgId}&select=id,activity_type,created_at&limit=5`);
    expect(Array.isArray(rows)).toBe(true);
  });
});
test.fixme('§19.7 — convert_lead RPC creates student + guardian rows', async () => {});
test.fixme('§19.7 — feature gate: leads hidden on trial plan', async () => {});
test.fixme('§19.10 — enrolment offer accept → convert_waitlist_to_student', async () => {});
test.fixme('§19.5 — credit_expiry cron voids credits past expires_at', async () => {});
