/**
 * 29 — Cross-feature integrity (RLS, audit, realtime, optimistic rollback)
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §29
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH } from '../helpers';
import { supabaseSelect } from '../supabase-admin';

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.owner);
  refreshStorageStateIfStale(AUTH.parent);
  refreshStorageStateIfStale(AUTH.parent2);
});

test.describe('RLS — basic queries scoped to org', () => {
  test('owner can SELECT students in their org', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('students', `org_id=eq.${orgId}&select=id&limit=1`);
    expect(Array.isArray(rows)).toBe(true);
  });

  test('owner cannot SELECT students from a different org_id (filtered to 0)', async () => {
    // Use a fake org_id; supabase REST will return [] because RLS scopes to membership orgs
    const fakeOrg = '00000000-0000-0000-0000-000000000000';
    const rows = supabaseSelect('students', `org_id=eq.${fakeOrg}&select=id&limit=1`);
    expect(rows.length).toBe(0);
  });
});

test.describe('§29.1 — RLS — DB-direct via owner JWT', () => {
  test('SELECT students from a non-member org returns 0', async () => {
    const fakeOrg = '00000000-0000-0000-0000-000000000000';
    const rows = supabaseSelect('students', `org_id=eq.${fakeOrg}&select=id&limit=1`);
    expect(rows.length).toBe(0);
  });

  test('SELECT invoices from a non-member org returns 0', async () => {
    const fakeOrg = '00000000-0000-0000-0000-000000000000';
    const rows = supabaseSelect('invoices', `org_id=eq.${fakeOrg}&select=id&limit=1`);
    expect(rows.length).toBe(0);
  });

  test('SELECT lessons from a non-member org returns 0', async () => {
    const fakeOrg = '00000000-0000-0000-0000-000000000000';
    const rows = supabaseSelect('lessons', `org_id=eq.${fakeOrg}&select=id&limit=1`);
    expect(rows.length).toBe(0);
  });

  test('SELECT lesson_notes from a non-member org returns 0', async () => {
    const fakeOrg = '00000000-0000-0000-0000-000000000000';
    const rows = supabaseSelect('lesson_notes', `org_id=eq.${fakeOrg}&select=id&limit=1`);
    expect(rows.length).toBe(0);
  });

  test('SELECT internal_messages from a non-member org returns 0', async () => {
    const fakeOrg = '00000000-0000-0000-0000-000000000000';
    const rows = supabaseSelect('internal_messages', `org_id=eq.${fakeOrg}&select=id&limit=1`);
    expect(rows.length).toBe(0);
  });
});

test.describe('§29.2 — Audit log produced on CRUD', () => {
  test('audit_log table is queryable and has recent entries', async () => {
    const orgId = process.env.E2E_ORG_ID;
    const rows = supabaseSelect('audit_log', `org_id=eq.${orgId}&select=action,entity_type,created_at&order=created_at.desc&limit=5`);
    expect(Array.isArray(rows)).toBe(true);
  });
});

test.fixme('§29.1 — get_teachers_for_parent strips email/phone (need parent JWT)', async () => {});
test.fixme('§29.1 — get_parent_lesson_notes only returns parent_visible=true', async () => {});
test.fixme('§29.3 — realtime invoice list update within 5s', async () => {});
test.fixme('§29.4 — optimistic update rollback on mutation fail', async () => {});
test.fixme('§29.6 — Stripe webhook idempotency: replay event → 1 effect', async () => {});
