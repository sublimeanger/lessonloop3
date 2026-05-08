/**
 * 24 — Stripe payments end-to-end
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §24
 *
 * REQUIRES: STRIPE_TEST_SECRET_KEY env var + Stripe test webhook
 * endpoint configured. See `.env.test.example` for layout.
 *
 * Currently scaffolded only — the test-mode dispatch hasn't yet been
 * wired into the Stripe edge functions (org.stripe_test_mode flag +
 * `_shared/stripe-client.ts` helper). Once that lands, populate.
 */
import { test } from './_fixtures/auth-refresh';

test.fixme('§24.3 — parent pays invoice via embedded drawer (test card 4242)', async () => {});
test.fixme('§24.3 — Apple Pay button visible only on iOS Safari', async () => {});
test.fixme('§24.5 — saved card list + default selection', async () => {});
test.fixme('§24.5 — detach saved card → stripe-detach-payment-method called', async () => {});
test.fixme('§24.6 — auto-pay installment success path', async () => {});
test.fixme('§24.6 — auto-pay failure → retry → final → email + invoice flagged', async () => {});
test.fixme('§24.7 — refund partial via Stripe → refunds row + payment refunded amount', async () => {});
test.fixme('§24.8 — dispute simulated via Stripe CLI → banner appears', async () => {});
test.fixme('§24.9 — Stripe Connect onboard → charges_enabled=true', async () => {});
test.fixme('§24.11 — verify session post-checkout → plan upgrade reflected', async () => {});
test.fixme('§24.12 — stripe-webhook idempotency: replay same event → single DB effect', async () => {});
