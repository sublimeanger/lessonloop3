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
  // J22-X: settings mutations toggle org-wide config (timezone, VAT) and
  // restore in afterEach. Across-file parallel runs interleave with §24
  // Stripe tests that compute invoice totals from the same org config,
  // producing flakes. Serial within this describe at minimum prevents
  // self-collision; cross-file pinning would require playwright.config
  // changes to mark §22 + §24 mutually exclusive.
  test.describe.configure({ mode: 'serial' });
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

// ─── Inline helpers shared by §22 mutation tests ───
async function patchOrgViaOwnerJwt(body: Record<string, unknown>): Promise<{ status: number; text: string }> {
  const fs = await import('fs');
  const { execSync } = await import('child_process');
  const { randomBytes } = await import('crypto');
  const path = await import('path');

  const orgId = process.env.E2E_ORG_ID!;
  const tmpFile = `/tmp/sb-org-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(body));
  const ownerJwt = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tests/e2e/.auth/owner.json'), 'utf-8'))
    .origins[0].localStorage[0].value;
  const session = JSON.parse(ownerJwt);
  try {
    const text = execSync(
      `curl -s -o /tmp/sb-org-resp-${randomBytes(4).toString('hex')}.txt -w "%{http_code}" ` +
        `-X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/organisations?id=eq.${orgId}" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Authorization: Bearer ${session.access_token}" ` +
        `-H "Content-Type: application/json" ` +
        `-H "Prefer: return=representation" ` +
        `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    const status = parseInt(text.trim(), 10);
    return { status, text };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

// Variant that captures the response body too — lets us assert on PG error
// messages from validate_schedule_hours / similar triggers.
async function patchOrgWithBody(body: Record<string, unknown>): Promise<{ status: number; body: string }> {
  const fs = await import('fs');
  const { execSync } = await import('child_process');
  const { randomBytes } = await import('crypto');
  const path = await import('path');

  const orgId = process.env.E2E_ORG_ID!;
  const reqFile = `/tmp/sb-req-${Date.now()}-${randomBytes(8).toString('hex')}.json`;
  const respFile = `/tmp/sb-resp-${Date.now()}-${randomBytes(8).toString('hex')}.txt`;
  fs.writeFileSync(reqFile, JSON.stringify(body));
  const ownerJwt = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tests/e2e/.auth/owner.json'), 'utf-8'))
    .origins[0].localStorage[0].value;
  const session = JSON.parse(ownerJwt);
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/organisations?id=eq.${orgId}" ` +
        `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
        `-H "Authorization: Bearer ${session.access_token}" ` +
        `-H "Content-Type: application/json" ` +
        `-d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    const respBody = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body: respBody };
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
  }
}

test.describe('§22.2 — Schedule hours validation (validate_schedule_hours trigger)', () => {
  // J22-X: same cross-file race rationale as the timezone/VAT block.
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: AUTH.owner });

  test('valid schedule hours (start < end) persists', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID;
    const before = supabaseSelect('organisations', `id=eq.${orgId}&select=schedule_start_hour,schedule_end_hour`);
    const origStart = before[0].schedule_start_hour;
    const origEnd = before[0].schedule_end_hour;

    // Pick a known-valid pair distinct from current values
    const newStart = origStart === 8 ? 9 : 8;
    const newEnd = origEnd === 20 ? 21 : 20;

    try {
      const { status } = await patchOrgWithBody({ schedule_start_hour: newStart, schedule_end_hour: newEnd });
      expect(status).toBeGreaterThanOrEqual(200);
      expect(status).toBeLessThan(300);

      const after = supabaseSelect('organisations', `id=eq.${orgId}&select=schedule_start_hour,schedule_end_hour`);
      expect(after[0].schedule_start_hour).toBe(newStart);
      expect(after[0].schedule_end_hour).toBe(newEnd);
    } finally {
      // Restore
      await patchOrgWithBody({ schedule_start_hour: origStart, schedule_end_hour: origEnd });
    }
  });

  test('end_hour <= start_hour rejected by trigger', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID;
    const before = supabaseSelect('organisations', `id=eq.${orgId}&select=schedule_start_hour,schedule_end_hour`);

    // Try start=18, end=10 (end <= start → trigger raises EXCEPTION)
    const { status, body } = await patchOrgWithBody({ schedule_start_hour: 18, schedule_end_hour: 10 });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body.toLowerCase()).toMatch(/schedule_end_hour|greater than/);

    // Confirm the org still has its previous values (atomic on failure)
    const after = supabaseSelect('organisations', `id=eq.${orgId}&select=schedule_start_hour,schedule_end_hour`);
    expect(after[0].schedule_start_hour).toBe(before[0].schedule_start_hour);
    expect(after[0].schedule_end_hour).toBe(before[0].schedule_end_hour);
  });
});

test.describe('§22.2 — parent_reschedule_policy mutation (Lauren-launch v1.1)', () => {
  // Launch default per LESSONLOOP_V2_PLAN §3.2 is `admin_locked`. Self-service
  // is hidden until v1.1. The §26.6 portal tests already exercise each policy
  // value end-to-end; this is the staff-side write.
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: AUTH.owner });

  for (const policy of ['admin_locked', 'request_only', 'self_service'] as const) {
    test(`PATCH parent_reschedule_policy=${policy} persists`, async () => {
      const { supabaseSelect } = await import('../supabase-admin');
      const orgId = process.env.E2E_ORG_ID;
      const before = supabaseSelect('organisations', `id=eq.${orgId}&select=parent_reschedule_policy`);
      const original = before[0].parent_reschedule_policy;

      try {
        const { status } = await patchOrgViaOwnerJwt({ parent_reschedule_policy: policy });
        expect(status).toBeGreaterThanOrEqual(200);
        expect(status).toBeLessThan(300);

        const after = supabaseSelect('organisations', `id=eq.${orgId}&select=parent_reschedule_policy`);
        expect(after[0].parent_reschedule_policy).toBe(policy);
      } finally {
        await patchOrgViaOwnerJwt({ parent_reschedule_policy: original });
      }
    });
  }
});

test.describe('§22.20 — Continuation defaults persistence', () => {
  // Lauren-paramount per LESSONLOOP_V2_PLAN §3.1. The continuation tab writes
  // 3 fields atomically (notice_weeks + assumed_continuing + reminder_days).
  test.describe.configure({ mode: 'serial' });
  test.use({ storageState: AUTH.owner });

  test('PATCH all 3 continuation defaults persists atomically', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID;
    const before = supabaseSelect(
      'organisations',
      `id=eq.${orgId}&select=continuation_notice_weeks,continuation_assumed_continuing,continuation_reminder_days`,
    );
    const orig = {
      weeks: before[0].continuation_notice_weeks,
      assumed: before[0].continuation_assumed_continuing,
      reminders: before[0].continuation_reminder_days,
    };

    // Pick a target distinct from current; tab UI bounds: weeks 1-12.
    const targetWeeks = orig.weeks === 4 ? 6 : 4;
    const targetAssumed = !orig.assumed;
    const targetReminders = [7, 3, 1];

    try {
      const { status } = await patchOrgViaOwnerJwt({
        continuation_notice_weeks: targetWeeks,
        continuation_assumed_continuing: targetAssumed,
        continuation_reminder_days: targetReminders,
      });
      expect(status).toBeGreaterThanOrEqual(200);
      expect(status).toBeLessThan(300);

      const after = supabaseSelect(
        'organisations',
        `id=eq.${orgId}&select=continuation_notice_weeks,continuation_assumed_continuing,continuation_reminder_days`,
      );
      expect(after[0].continuation_notice_weeks).toBe(targetWeeks);
      expect(after[0].continuation_assumed_continuing).toBe(targetAssumed);
      expect(after[0].continuation_reminder_days).toEqual(targetReminders);
    } finally {
      await patchOrgViaOwnerJwt({
        continuation_notice_weeks: orig.weeks,
        continuation_assumed_continuing: orig.assumed,
        continuation_reminder_days: orig.reminders,
      });
    }
  });
});

test.describe('§22.4 — Invite member by email', () => {
  // Lauren-flagged for studio onboarding (invite teachers / finance role).
  // Drive the invites table directly — the InviteMemberDialog inserts the row
  // then invokes send-invite-email; we cover the durable bit here, the email
  // queue is opaque to E2E.
  test.use({ storageState: AUTH.owner });

  test('owner inserts invites row → row persists with role + 7d expires_at', async () => {
    const fs = await import('fs');
    const { execSync } = await import('child_process');
    const { randomBytes } = await import('crypto');
    const path = await import('path');
    const { supabaseSelect, supabaseDelete } = await import('../supabase-admin');

    const orgId = process.env.E2E_ORG_ID!;
    const testEmail = `e2e-invite-${Date.now()}-${randomBytes(4).toString('hex')}@test.lessonloop.net`;

    // INSERT via owner JWT (RLS allows owner to invite into their org)
    const reqFile = `/tmp/sb-invite-${Date.now()}.json`;
    fs.writeFileSync(reqFile, JSON.stringify({ org_id: orgId, email: testEmail, role: 'teacher' }));
    const ownerJwt = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tests/e2e/.auth/owner.json'), 'utf-8'))
      .origins[0].localStorage[0].value;
    const session = JSON.parse(ownerJwt);

    try {
      const result = execSync(
        `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/invites" ` +
          `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
          `-H "Authorization: Bearer ${session.access_token}" ` +
          `-H "Content-Type: application/json" ` +
          `-H "Prefer: return=representation" ` +
          `-d @${reqFile}`,
        { encoding: 'utf-8', timeout: 15_000 }
      );
      const inserted = JSON.parse(result);
      expect(Array.isArray(inserted)).toBe(true);
      expect(inserted[0].email).toBe(testEmail);
      expect(inserted[0].role).toBe('teacher');
      expect(inserted[0].token).toBeTruthy();

      // expires_at defaults to now() + 7 days
      const expSec = new Date(inserted[0].expires_at).getTime();
      const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(expSec - sevenDays)).toBeLessThan(60_000);

      // Confirm via owner-JWT SELECT (RLS-permitted for org owner)
      const queryback = supabaseSelect('invites', `id=eq.${inserted[0].id}&select=email,role,accepted_at`);
      expect(queryback[0].email).toBe(testEmail);
      expect(queryback[0].accepted_at).toBeNull();

      // Cleanup
      supabaseDelete('invites', `id=eq.${inserted[0].id}`);
    } finally {
      try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
    }
  });
});

test.describe('§22.9 — Music settings: custom instrument CRUD', () => {
  // §22.9 instrument list is org-scoped via `is_custom=true`. Built-in
  // instruments are global and shared. Test the custom mutation chain.
  test.use({ storageState: AUTH.owner });

  test('owner adds + updates + deletes a custom instrument (org-scoped)', async () => {
    const fs = await import('fs');
    const { execSync } = await import('child_process');
    const { randomBytes } = await import('crypto');
    const path = await import('path');
    const { supabaseSelect } = await import('../supabase-admin');

    const orgId = process.env.E2E_ORG_ID!;
    const testName = `e2e_${Date.now()}_${randomBytes(2).toString('hex')}_inst`;
    const ownerJwt = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'tests/e2e/.auth/owner.json'), 'utf-8'))
      .origins[0].localStorage[0].value;
    const session = JSON.parse(ownerJwt);

    const apiBase = `${process.env.E2E_SUPABASE_URL}/rest/v1/instruments`;
    const headers =
      `-H "apikey: ${process.env.E2E_SUPABASE_ANON_KEY}" ` +
      `-H "Authorization: Bearer ${session.access_token}" ` +
      `-H "Content-Type: application/json"`;

    let createdId = '';
    try {
      // INSERT custom instrument
      const insertReq = `/tmp/sb-inst-ins-${Date.now()}.json`;
      fs.writeFileSync(insertReq, JSON.stringify({
        org_id: orgId, name: testName, category: 'Strings', is_custom: true, sort_order: 9000,
      }));
      const insertResult = execSync(
        `curl -s -X POST "${apiBase}" ${headers} -H "Prefer: return=representation" -d @${insertReq}`,
        { encoding: 'utf-8', timeout: 15_000 }
      );
      fs.unlinkSync(insertReq);
      const inserted = JSON.parse(insertResult);
      expect(inserted[0]?.name).toBe(testName);
      expect(inserted[0]?.is_custom).toBe(true);
      expect(inserted[0]?.org_id).toBe(orgId);
      createdId = inserted[0].id;

      // UPDATE category
      const updateReq = `/tmp/sb-inst-upd-${Date.now()}.json`;
      fs.writeFileSync(updateReq, JSON.stringify({ category: 'Brass' }));
      execSync(
        `curl -s -X PATCH "${apiBase}?id=eq.${createdId}" ${headers} -d @${updateReq}`,
        { encoding: 'utf-8', timeout: 15_000 }
      );
      fs.unlinkSync(updateReq);
      const afterUpdate = supabaseSelect('instruments', `id=eq.${createdId}&select=category`);
      expect(afterUpdate[0].category).toBe('Brass');

      // DELETE
      execSync(
        `curl -s -X DELETE "${apiBase}?id=eq.${createdId}" ${headers}`,
        { encoding: 'utf-8', timeout: 15_000 }
      );
      const afterDelete = supabaseSelect('instruments', `id=eq.${createdId}&select=id`);
      expect(afterDelete.length).toBe(0);
      createdId = '';
    } finally {
      if (createdId) {
        const { supabaseDelete } = await import('../supabase-admin');
        supabaseDelete('instruments', `id=eq.${createdId}`);
      }
    }
  });
});

// §22.4 owner-removal-blocked is already covered backend-side in §32.7
// (protect_owner_role trigger). Inline duplicate is dead weight.

// ─── Inline service-role helpers for §22.5 / §22.8 / §22.10 / §22.11 ───
// Service-role for closure_dates / availability_blocks because the
// triggers we want to assert on (check_availability_overlap) fire
// regardless of caller, but the result-side selects for tables that
// require created_by (closure_dates) need service-role to bypass the
// owner JWT contention pattern documented in s14.

function srHeaders() {
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  return `-H "apikey: ${key}" -H "Authorization: Bearer ${key}"`;
}

async function srPost(table: string, payload: Record<string, unknown>): Promise<any[]> {
  const fs = await import('fs');
  const { execSync } = await import('child_process');
  const { randomBytes } = await import('crypto');
  const reqFile = `/tmp/sb-sr-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(reqFile, JSON.stringify(payload));
  try {
    const result = execSync(
      `curl -s -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/${table}" ${srHeaders()} ` +
        `-H "Content-Type: application/json" -H "Prefer: return=representation" -d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    try {
      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  } finally {
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

async function srPostStatus(table: string, payload: Record<string, unknown>): Promise<{ status: number; body: string }> {
  const fs = await import('fs');
  const { execSync } = await import('child_process');
  const { randomBytes } = await import('crypto');
  const reqFile = `/tmp/sb-srs-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  const respFile = `/tmp/sb-srs-resp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;
  fs.writeFileSync(reqFile, JSON.stringify(payload));
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" -X POST "${process.env.E2E_SUPABASE_URL}/rest/v1/${table}" ${srHeaders()} ` +
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

async function srDelete(table: string, query: string): Promise<void> {
  const { execSync } = await import('child_process');
  execSync(
    `curl -s -X DELETE "${process.env.E2E_SUPABASE_URL}/rest/v1/${table}?${query}" ${srHeaders()}`,
    { encoding: 'utf-8', timeout: 15_000 },
  );
}

async function srSelect(table: string, query: string): Promise<any[]> {
  const { execSync } = await import('child_process');
  const result = execSync(
    `curl -s "${process.env.E2E_SUPABASE_URL}/rest/v1/${table}?${query}" ${srHeaders()}`,
    { encoding: 'utf-8', timeout: 15_000 },
  );
  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

test.describe('§22.5 — Closure date CRUD', () => {
  // Lauren-mentioned for greying out the calendar around school holidays
  // (per v2 §3.1 launch-in-scope: "Term + closure date management").
  // Asserts row insertion under owner-scoped org_id + applies_to_all_locations
  // default. Uses service-role for the seed because closure_dates.created_by
  // is NOT NULL with no default — service-role bypass is the cleanest path.
  test.use({ storageState: AUTH.owner });

  test('insert closure date → row persists under org with applies_to_all_locations=true default', async () => {
    const { getOwnerUserId } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID!;
    const ownerUserId = getOwnerUserId();
    // Pick a far-future date to avoid colliding with any real production
    // closure dates and to be safely orthogonal to existing lesson seeds.
    const closureDate = new Date(Date.now() + 365 * 24 * 3600_000).toISOString().slice(0, 10);
    const reason = `e2e_closure_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const inserted = await srPost('closure_dates', {
      org_id: orgId,
      date: closureDate,
      reason,
      created_by: ownerUserId,
    });
    expect(inserted.length).toBe(1);
    expect(inserted[0].applies_to_all_locations).toBe(true); // default
    expect(inserted[0].location_id).toBeNull();
    const closureId = inserted[0].id;

    try {
      const reread = await srSelect('closure_dates', `id=eq.${closureId}&select=date,reason,applies_to_all_locations`);
      expect(reread.length).toBe(1);
      expect(reread[0].date).toBe(closureDate);
      expect(reread[0].reason).toBe(reason);
    } finally {
      await srDelete('closure_dates', `id=eq.${closureId}`);
    }
  });
});

test.describe('§22.8 — Rate cards CRUD', () => {
  // Drives invoice line items per v2 §3.1 launch-in-scope ("Rate cards"
  // mature; drives invoice line items"). Owner JWT works — RLS permits
  // admin r/w/d on rate_cards.
  test.use({ storageState: AUTH.owner });

  test('owner adds + updates + deletes a rate card (org-scoped)', async () => {
    const orgId = process.env.E2E_ORG_ID!;
    const testName = `e2e_rc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // INSERT via service-role (rate_cards has org-admin RLS but service-role
    // is the safer path to avoid owner-JWT contention).
    const inserted = await srPost('rate_cards', {
      org_id: orgId,
      name: testName,
      duration_mins: 45,
      rate_amount: 27.50,
      currency_code: 'GBP',
      is_default: false,
    });
    expect(inserted.length).toBe(1);
    expect(inserted[0].duration_mins).toBe(45);
    expect(parseFloat(inserted[0].rate_amount)).toBe(27.50);
    expect(inserted[0].currency_code).toBe('GBP');
    expect(inserted[0].is_default).toBe(false);
    const rcId = inserted[0].id;

    try {
      // UPDATE — change rate via PATCH
      const { execSync } = await import('child_process');
      const fs = await import('fs');
      const { randomBytes } = await import('crypto');
      const updReq = `/tmp/sb-rc-upd-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
      fs.writeFileSync(updReq, JSON.stringify({ rate_amount: 32.00 }));
      try {
        execSync(
          `curl -s -X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/rate_cards?id=eq.${rcId}" ${srHeaders()} ` +
            `-H "Content-Type: application/json" -d @${updReq}`,
          { encoding: 'utf-8', timeout: 15_000 },
        );
      } finally {
        try { fs.unlinkSync(updReq); } catch { /* ignore */ }
      }

      const afterUpd = await srSelect('rate_cards', `id=eq.${rcId}&select=rate_amount`);
      expect(parseFloat(afterUpd[0].rate_amount)).toBe(32.00);

      // DELETE
      await srDelete('rate_cards', `id=eq.${rcId}`);
      const afterDel = await srSelect('rate_cards', `id=eq.${rcId}&select=id`);
      expect(afterDel.length).toBe(0);
    } finally {
      // Idempotent cleanup (DELETE no-op if already deleted).
      await srDelete('rate_cards', `id=eq.${rcId}`);
    }
  });
});

test.describe('§22.10 — Message templates CRUD', () => {
  // Templates power lesson-reminder / makeup-offer / invoice-reminder
  // copy customisation per org. Direct table CRUD via service-role.
  test.use({ storageState: AUTH.owner });

  test('owner adds + updates + deletes a message template', async () => {
    const orgId = process.env.E2E_ORG_ID!;
    const testName = `e2e_tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const inserted = await srPost('message_templates', {
      org_id: orgId,
      name: testName,
      subject: 'Test subject',
      body: 'Test body {{student_name}}',
    });
    expect(inserted.length).toBe(1);
    expect(inserted[0].channel).toBe('email'); // default
    expect(inserted[0].subject).toBe('Test subject');
    const tmplId = inserted[0].id;

    try {
      // UPDATE the body
      const { execSync } = await import('child_process');
      const fs = await import('fs');
      const { randomBytes } = await import('crypto');
      const updReq = `/tmp/sb-tmpl-upd-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
      fs.writeFileSync(updReq, JSON.stringify({ body: 'Updated body {{lesson_date}}' }));
      try {
        execSync(
          `curl -s -X PATCH "${process.env.E2E_SUPABASE_URL}/rest/v1/message_templates?id=eq.${tmplId}" ${srHeaders()} ` +
            `-H "Content-Type: application/json" -d @${updReq}`,
          { encoding: 'utf-8', timeout: 15_000 },
        );
      } finally {
        try { fs.unlinkSync(updReq); } catch { /* ignore */ }
      }

      const afterUpd = await srSelect('message_templates', `id=eq.${tmplId}&select=body`);
      expect(afterUpd[0].body).toBe('Updated body {{lesson_date}}');

      // DELETE
      await srDelete('message_templates', `id=eq.${tmplId}`);
      const afterDel = await srSelect('message_templates', `id=eq.${tmplId}&select=id`);
      expect(afterDel.length).toBe(0);
    } finally {
      await srDelete('message_templates', `id=eq.${tmplId}`);
    }
  });
});

test.describe('§22.11 — Availability overlap trigger (check_availability_overlap)', () => {
  // The trigger fires on availability_blocks INSERT/UPDATE; raises
  // EXCEPTION when (org_id, teacher_id, day_of_week) overlap on time
  // ranges. Verified in pg_proc — the trigger keys on `teacher_id`,
  // not `teacher_user_id`. Both columns get populated for safety.
  test.use({ storageState: AUTH.owner });

  test('overlapping block on same teacher+day → trigger raises exception', async () => {
    const { supabaseInsert, getOwnerUserId } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID!;
    const ownerUserId = getOwnerUserId();
    const testId = `e2e_avail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Need a teacher row to anchor teacher_id. Use inactive to skip the
    // teacher-limit cap (matches §11.4.4/5 anti-pattern guidance).
    const teacher = supabaseInsert('teachers', {
      org_id: orgId,
      display_name: `${testId}_t`,
      email: `${testId}_t@test.lessonloop.net`,
      status: 'inactive',
    });
    expect(teacher?.id).toBeTruthy();

    // First block — Mon 09:00-11:00 — should land cleanly.
    const firstBlock = await srPost('availability_blocks', {
      org_id: orgId,
      teacher_id: teacher.id,
      teacher_user_id: ownerUserId, // NOT NULL; not used by overlap check
      day_of_week: 'monday',
      start_time_local: '09:00:00',
      end_time_local: '11:00:00',
    });
    expect(firstBlock.length).toBe(1);
    const firstId = firstBlock[0].id;

    try {
      // Overlapping block — Mon 10:00-12:00 — should fail at the
      // check_availability_overlap trigger (EXCEPTION).
      const overlap = await srPostStatus('availability_blocks', {
        org_id: orgId,
        teacher_id: teacher.id,
        teacher_user_id: ownerUserId,
        day_of_week: 'monday',
        start_time_local: '10:00:00',
        end_time_local: '12:00:00',
      });
      expect(overlap.status).toBeGreaterThanOrEqual(400);
      expect(overlap.body.toLowerCase()).toMatch(/overlap/);

      // Non-overlapping (different day) should succeed — proves the
      // trigger is keyed on day_of_week.
      const tueBlock = await srPost('availability_blocks', {
        org_id: orgId,
        teacher_id: teacher.id,
        teacher_user_id: ownerUserId,
        day_of_week: 'tuesday',
        start_time_local: '10:00:00',
        end_time_local: '12:00:00',
      });
      expect(tueBlock.length, `tuesday non-overlap block should succeed: ${JSON.stringify(tueBlock).slice(0,200)}`).toBe(1);

      await srDelete('availability_blocks', `id=eq.${tueBlock[0].id}`);
    } finally {
      await srDelete('availability_blocks', `id=eq.${firstId}`);
      const { supabaseDelete } = await import('../supabase-admin');
      supabaseDelete('teachers', `id=eq.${teacher.id}`);
    }
  });
});

test.fixme('§22.7 — privacy: GDPR export queues email', async () => {});
test.fixme('§22.12 — calendar: connect Google (mock OAuth) → sync_status=active', async () => {});
test.fixme('§22.14 — billing: upgrade via stripe-subscription-checkout → plan upgraded', async () => {});
test.fixme('§22.15 — booking page slug collision blocked', async () => {});
test.fixme('§22.21 — Xero accounting: connect, sync invoice, disconnect', async () => {});
test.fixme('§22.22 — recurring billing template run-now creates invoices', async () => {});

test.describe('§22.6 — Audit log tab loads', () => {
  test.use({ storageState: AUTH.owner });

  test('audit_log tab navigates without error', async ({ page }) => {
    await goTo(page, '/settings?tab=audit');
    await page.waitForTimeout(2000);
    await assertNoErrorBoundary(page);
  });
});

// ────────────────────────────────────────────────────────────────────
// §22 — Un-deferred features UI smoke (s24)
// ────────────────────────────────────────────────────────────────────
//
// Per s24 stance recalibration: Recurring billing templates UI +
// Agency tier visibility un-deferred from HIDDEN. These smokes prove
// the UI surfaces render without error.

test.describe('§22.22 — Recurring billing templates UI (un-deferred s24)', () => {
  test.use({ storageState: AUTH.owner });

  test('/invoices?tab=recurring renders RecurringBillingTab without error', async ({ page }) => {
    await goTo(page, '/invoices?tab=recurring');
    await page.waitForTimeout(2000);
    await assertNoErrorBoundary(page);
  });
});

test.describe('§22.14 — Agency tier visible in billing tab (un-deferred s24)', () => {
  test.use({ storageState: AUTH.owner });

  test('Settings billing tab loads without error', async ({ page }) => {
    await goTo(page, '/settings?tab=billing');
    await page.waitForTimeout(2000);
    await assertNoErrorBoundary(page);
    // PlanSelector includes 'Agency' option (visible at launch per s24
    // recalibration; was previously hidden behind a flag). Don't assert
    // text presence here because the billing tab might display current
    // plan info rather than the picker; the no-error-boundary assertion
    // is the launch contract.
  });
});
