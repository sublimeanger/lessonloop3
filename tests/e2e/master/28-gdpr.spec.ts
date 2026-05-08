/**
 * 28 — GDPR & privacy
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §28
 *
 * Destructive flows — only run with caution. The org-level delete
 * tests must NEVER be run against a production project.
 */
import { test } from './_fixtures/auth-refresh';

test.describe('GDPR exports', () => {
  test.fixme('§28.1 — owner export → email queued + ZIP contents include CSVs', async () => {});
});

test.describe('Anonymise (RPC)', () => {
  test.fixme('§28.3 — anonymise_student RPC: name=Redacted, email/phone=null', async () => {});
  test.fixme('§28.3 — anonymise_guardian RPC: name=Redacted, email/phone=null', async () => {});
});

test.describe('Account delete (user-level)', () => {
  test.fixme('§28.4 — confirm two-step → user signed out, profile removed', async () => {});
});

test.describe('Org delete (DESTRUCTIVE — non-prod only)', () => {
  test.skip(({}, testInfo) => testInfo.project.use?.baseURL?.includes('app.lessonloop.net'), 'Skip on production');
  test.fixme('§28.4 — entire org wiped + cascade rollups', async () => {});
});
