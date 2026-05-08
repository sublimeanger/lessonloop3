/**
 * 30 — Error & edge-case workflows
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §30
 *
 * Most of these already exist in `tests/e2e/workflows/error-*.spec.ts`.
 * This master file is the index — individual fixmes here mirror
 * those existing test names so coverage is visible at a glance.
 */
import { test } from './_fixtures/auth-refresh';

test.describe('§30.1 — Error currency', () => {
  test.fixme('USD org renders $ on amounts; switch to GBP affects new invoices only', async () => {});
});

test.describe('§30.2 — Duplicates (covered by workflows/error-duplicates)', () => {
  test.fixme('student name+DOB duplicate prompt', async () => {});
  test.fixme('guardian email duplicate "use existing" suggestion', async () => {});
  test.fixme('lesson conflict detection', async () => {});
  test.fixme('invite same email twice updates pending', async () => {});
  test.fixme('booking page slug uniqueness', async () => {});
});

test.describe('§30.3 — Empty states', () => {
  test.fixme('every list page renders empty-state copy + CTA', async () => {});
});

test.describe('§30.4 — Empty submissions', () => {
  test.fixme('blank form submission → field-level validation', async () => {});
  test.fixme('whitespace-only fields trimmed', async () => {});
});

test.describe('§30.5 — Long text', () => {
  test.fixme('names > 100 chars truncated/blocked', async () => {});
  test.fixme('lesson notes 10k chars saved + rendered', async () => {});
});

test.describe('§30.6 — Special chars', () => {
  test.fixme('apostrophe in names ("O\'Brien")', async () => {});
  test.fixme('emoji in names + messages', async () => {});
  test.fixme('HTML/script injection sanitised by DOMPurify', async () => {});
  test.fixme('CSV export sanitises formula injection', async () => {});
});

test.describe('§30.7 — Error boundary resilience', () => {
  test.fixme('SectionErrorBoundary contains a sub-component throw', async () => {});
});

test.describe('§30.8 — URL attacks', () => {
  test.fixme('inviteReturn=//evil.com is rejected', async () => {});
  test.fixme('post-login `from` with //evil.com is rejected', async () => {});
});
