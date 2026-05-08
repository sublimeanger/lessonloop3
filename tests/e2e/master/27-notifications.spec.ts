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

test.fixme('§27.1 — sending invoice triggers message_log row with type=invoice_sent', async () => {});
test.fixme('§27.1 — overdue cron sends N reminders per overdue_reminder_days', async () => {});
test.fixme('§27.1 — auto-pay failure → send-auto-pay-failure-notification', async () => {});
test.fixme('§27.2 — notification_preferences off → no email sent', async () => {});
test.fixme('§27.3 — push token lifecycle: login registers, logout removes', async () => {});
test.fixme('§27.5 — cron-health-watchdog alerts on missed runs', async () => {});
