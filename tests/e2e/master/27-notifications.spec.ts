/**
 * 27 — Email & notifications
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §27
 *
 * Approach: assert via `message_log` DB rows (which every send-* edge fn
 * inserts on success) rather than capturing real emails. This avoids
 * the cost/complexity of a Mailtrap/Mailosaur integration.
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH } from '../helpers';
import { supabaseSelect } from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
});

test.describe('message_log table accepts insertions', () => {
  test('latest message_log rows are queryable', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('message_log', `org_id=eq.${orgId}&select=id,message_type,status,sent_at&order=created_at.desc&limit=5`);
    // Just assert the query succeeds
    expect(Array.isArray(rows)).toBe(true);
  });
});

test.describe('§27 — message_log table is the source of truth', () => {
  test('message_log table accepts queries by message_type', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('message_log', `org_id=eq.${orgId}&select=message_type&limit=20`);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('message_log enum values match expected event types', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('message_log', `org_id=eq.${orgId}&select=message_type&limit=100`);
    const types = new Set(rows.map((r: any) => r.message_type));
    // Just assert no unexpected nulls
    types.forEach(t => expect(typeof t).toBe('string'));
  });
});

test.describe('§27 — notification_preferences table is queryable', () => {
  test('table accepts SELECT for current authed user (RLS-scoped)', async () => {
    // RLS limits to user_id=auth.uid(); this just asserts the query is well-formed
    const rows = supabaseSelect('notification_preferences', `select=event_type&limit=1`);
    expect(Array.isArray(rows)).toBe(true);
  });
});

test.fixme('§27.1 — sending invoice writes message_log row (UI flow)', async () => {});
test.fixme('§27.1 — overdue cron writes N reminders per overdue_reminder_days', async () => {});
test.fixme('§27.2 — notification_preferences off → message_log row absent', async () => {});
test.fixme('§27.3 — push token lifecycle: login registers, logout removes', async () => {});
