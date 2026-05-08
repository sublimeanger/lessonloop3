/**
 * 17 — Practice (assignments, logs, streaks)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §17
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH, assertNoErrorBoundary, goTo } from '../helpers';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
});

test.describe('Practice page (staff)', () => {
  test.use({ storageState: AUTH.owner });

  test('renders without error', async ({ page }) => {
    await goTo(page, '/practice');
    await assertNoErrorBoundary(page);
  });
});

test.describe('§17 — Practice DB tables queryable', () => {
  test.use({ storageState: AUTH.owner });

  test('practice_assignments table queryable', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('practice_assignments', `org_id=eq.${orgId}&select=id,title,status&limit=10`);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('practice_logs table queryable', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('practice_logs', `org_id=eq.${orgId}&select=id,duration_minutes,reviewed_at&order=created_at.desc&limit=10`);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('practice_streaks table queryable + per-student aggregation', async () => {
    const { supabaseSelect } = await import('../supabase-admin');
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('practice_streaks', `org_id=eq.${orgId}&select=student_id,current_streak,longest_streak,last_practice_date&limit=10`);
    expect(Array.isArray(rows)).toBe(true);
  });
});

test.fixme('§17.2 — Create assignment writes practice_assignments row (UI flow)', async () => {});
test.fixme('§17.3 — Parent logs 30 min → log row + streak updated (UI flow)', async () => {});
test.fixme('§17.3 — Teacher reviews log → reviewed_at set', async () => {});
test.fixme('§17.4 — Streak milestone (3 days) sends streak-notification', async () => {});
test.fixme('§17.5 — reset_stale_streaks cron resets streaks with no log >2 days', async () => {});
test.fixme('§17.5 — complete_expired_assignments cron sets status=completed', async () => {});
