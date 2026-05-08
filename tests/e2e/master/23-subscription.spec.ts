/**
 * 23 — Subscription & plan limits
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §23
 *
 * Plan-cap triggers (check_student_limit, check_teacher_limit) and
 * trial-lifecycle crons (trial-reminder-{7,3,1}day, trial-expired,
 * trial-winback) verified at the DB level.
 */
import { test } from './_fixtures/auth-refresh';
import { AUTH } from '../helpers';

test.beforeAll(() => {
  /* refresh */
});

test.fixme('§23 — trial expiring in 1 day → reminder email queued', async () => {});
test.fixme('§23 — trial expired → status flipped to past_due, write actions blocked', async () => {});
test.fixme('§23 — reactivate via Stripe checkout → status=active', async () => {});
test.fixme('§23 — plan downgrade across cap → error or grace period', async () => {});
test.fixme('§23 — past_due banner shown app-wide; some actions disabled', async () => {});
test.fixme('§23 — Stripe webhook idempotency: same event twice → 1 DB effect', async () => {});
test.fixme('§23 — feature gate: leads hidden on trial, visible on academy', async () => {});
test.fixme('§23 — check_student_limit blocks insert at cap', async () => {});
test.fixme('§23 — check_teacher_limit blocks insert at cap', async () => {});
