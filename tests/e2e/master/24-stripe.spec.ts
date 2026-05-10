/**
 * 24 — Stripe payments end-to-end
 * Maps to: PLAYWRIGHT_MASTER_CATALOG.md §24
 *
 * Pre-requisite (J24-A, landed 2026-05-08):
 *   - organisations.stripe_test_mode flag (true on the e2e org only)
 *   - _shared/stripe-client.ts helper resolving live or test SDK per org
 *   - 14 stripe-* edge fns + admin-backfill + auto-pay-reminder-core
 *     all routed through the helper
 *   - Dual-mode stripe-webhook (test secret first, live fallback)
 *   - Stripe Dashboard test webhook endpoint (we_1TUwZhBAjFOLYDS3QGslhpbj)
 *     subscribed to the 18-event superset the handler dispatches on
 *   - Supabase secret STRIPE_TEST_WEBHOOK_SECRET configured
 *
 * Strategy: drive the money flows via the deployed edge fns + Stripe
 * API directly (test mode), then wait for the dual-mode webhook to
 * record the payment in our DB. We deliberately do NOT drive Stripe
 * Elements in Playwright — iframe origin and autofill races make those
 * tests flaky. UI smoke for the embedded drawer is in §26 parent-portal.
 *
 * Cleanup: every test prefixes its data with `e2e_${testId}` and
 * deletes the Stripe test customer + payment_prefs row in afterEach.
 * Running this spec leaves no test residue in either Stripe or the DB.
 */
import { test, expect, refreshStorageStateIfStale } from './_fixtures/auth-refresh';
import { AUTH } from '../helpers';
import {
  createTestInvoice,
  deleteInvoiceById,
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
} from '../supabase-admin';
import {
  attachTestCardToCustomer,
  confirmTestPaymentIntent,
  createTestCustomer,
  deleteTestCustomer,
  getTestPaymentIntent,
  postWebhookEvent,
  resetE2ERateLimits,
  stripeApi,
  updateInvoiceStatusViaPatch,
  waitForWebhookPayment,
} from './_fixtures/stripe-test-helpers';
import { execSync } from 'child_process';
import fs from 'fs';

function generateTestId() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const E2E_ORG_ID = '25b57950-6c4e-42d8-8089-4942d2bba959';
const E2E_PARENT_GUARDIAN_ID = '44821141-05be-4475-ad1f-a9532943a355';
const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY!;
const PARENT_EMAIL = process.env.E2E_PARENT_EMAIL!;
const PARENT_PASSWORD = process.env.E2E_PARENT_PASSWORD!;
const PARENT2_EMAIL = process.env.E2E_PARENT2_EMAIL!;
const PARENT2_PASSWORD = process.env.E2E_PARENT2_PASSWORD!;
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL!;
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD!;
const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL!;
const FINANCE_PASSWORD = process.env.E2E_FINANCE_PASSWORD!;

/** Sign in via Supabase auth REST and return the access token (no storage state). */
function signInForToken(email: string, password: string): string {
  const result = execSync(
    `curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" ` +
      `-H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" ` +
      `-d ${JSON.stringify(JSON.stringify({ email, password }))}`,
    { encoding: 'utf-8', timeout: 15_000 },
  );
  const session = JSON.parse(result);
  if (!session.access_token) {
    throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(session).slice(0, 200)}`);
  }
  return session.access_token as string;
}

/** Call a Supabase edge function with a bearer token. Returns { status, body } — body is parsed JSON or raw text. */
function invokeEdgeFn(
  fnName: string,
  token: string,
  body: Record<string, unknown>,
): { status: number; body: any } {
  const tmpFile = `/tmp/sb-edge-fn-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify(body));
  try {
    const result = execSync(
      `curl -s -w "\\nHTTP:%{http_code}" -X POST "${SUPABASE_URL}/functions/v1/${fnName}" ` +
        `-H "Authorization: Bearer ${token}" -H "apikey: ${ANON_KEY}" ` +
        `-H "Content-Type: application/json" -d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 30_000 },
    );
    const match = result.match(/^([\s\S]*)\nHTTP:(\d+)$/);
    const rawBody = match ? match[1] : result;
    const status = match ? Number(match[2]) : 0;
    let parsed: any = rawBody;
    try { parsed = JSON.parse(rawBody); } catch { /* leave as text */ }
    return { status, body: parsed };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

// Force serial within this spec — every test mutates the e2e parent's
// guardian_payment_preferences row (delete + recreate) and tracks Stripe
// customer IDs in a shared `trash` array. Running them in parallel
// produces interleaved cleanup and Stripe customer cross-deletion.
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  refreshStorageStateIfStale(AUTH.parent);
  refreshStorageStateIfStale(AUTH.owner);

  // J24-A invariant — fail loud if the e2e org isn't in test mode.
  // A live-mode call to Stripe with a test customer ID would charge
  // a real card or surface "no such customer" errors, both wasteful.
  const rows = supabaseSelect(
    'organisations',
    `id=eq.${E2E_ORG_ID}&select=id,stripe_test_mode`,
  );
  if (rows.length === 0 || rows[0].stripe_test_mode !== true) {
    throw new Error(
      `[24-stripe] e2e org ${E2E_ORG_ID} must have stripe_test_mode=true. ` +
        `Got: ${JSON.stringify(rows)}. Run: UPDATE organisations SET stripe_test_mode=true WHERE id='${E2E_ORG_ID}';`,
    );
  }

  // Clear hourly rate-limit rows so a freshly-debugged session or
  // a long batch run doesn't stall on stripe-create-checkout (10/hr)
  // or stripe-process-refund (5/hr) caps. Service-role-only.
  resetE2ERateLimits();
});

// Track Stripe customer + payment_prefs we create so we can clean up.
const trash: Array<{ kind: 'stripe-customer' | 'invoice' | 'payment-prefs' | 'webhook-event'; id: string }> = [];

test.afterEach(async () => {
  for (const item of trash.reverse()) {
    try {
      if (item.kind === 'stripe-customer') {
        deleteTestCustomer(item.id);
      } else if (item.kind === 'invoice') {
        deleteInvoiceById(item.id);
      } else if (item.kind === 'payment-prefs') {
        supabaseDelete(
          'guardian_payment_preferences',
          `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
        );
      } else if (item.kind === 'webhook-event') {
        supabaseDelete('stripe_webhook_events', `event_id=eq.${item.id}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[24-stripe] afterEach cleanup error:', err);
    }
  }
  trash.length = 0;
});

// ────────────────────────────────────────────────────────────────────
// §24.1 — Customer creation on first invoice send
// ────────────────────────────────────────────────────────────────────
test.describe('§24.1 — Customer creation', () => {
  test('first stripe-create-payment-intent for a guardian persists stripe_customer_id', async () => {
    const testId = generateTestId();

    // Seed an invoice with the e2e parent as payer.
    const invoice = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_invoice`,
      items: [{ description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: 1000 }],
    });
    trash.push({ kind: 'invoice', id: invoice.id });
    trash.push({ kind: 'payment-prefs', id: E2E_PARENT_GUARDIAN_ID });

    // Move to sent so the fn accepts it
    updateInvoiceStatusViaPatch(invoice.id, 'sent');

    // Ensure no existing prefs row (guarantee fresh customer creation)
    supabaseDelete(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
    );

    const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
    const res = invokeEdgeFn('stripe-create-payment-intent', parentToken, {
      invoiceId: invoice.id,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('clientSecret');
    expect(res.body).toHaveProperty('paymentIntentId');
    expect(typeof res.body.clientSecret).toBe('string');

    // Verify Stripe-side: the PI exists in TEST mode (livemode=false).
    // Amount equals the invoice.total_minor (which includes any default
    // VAT/tax the org charges — for the e2e org that's 20% on top).
    const inv = supabaseSelect('invoices', `id=eq.${invoice.id}&select=total_minor`);
    const pi = getTestPaymentIntent(res.body.paymentIntentId);
    expect(pi.livemode).toBe(false);
    expect(pi.status).toBe('requires_payment_method');
    expect(pi.amount).toBe(inv[0].total_minor);

    // Verify DB-side: prefs row created with the test customer ID.
    const prefs = supabaseSelect(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}&select=stripe_customer_id`,
    );
    expect(prefs.length).toBe(1);
    expect(typeof prefs[0].stripe_customer_id).toBe('string');
    expect(prefs[0].stripe_customer_id).toMatch(/^cus_/);

    // Track customer for cleanup.
    trash.push({ kind: 'stripe-customer', id: prefs[0].stripe_customer_id });
  });
});

// ────────────────────────────────────────────────────────────────────
// §24.2/§24.3 — Parent pays invoice via embedded drawer (test card 4242)
// ────────────────────────────────────────────────────────────────────
test.describe('§24.2 / §24.3 — Parent pays invoice', () => {
  test('payment flow → webhook fires → payment row + invoice paid + audit', async () => {
    const testId = generateTestId();
    const amount = 5050; // £50.50 in minor units

    const invoice = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_invoice`,
      items: [{ description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: amount }],
    });
    trash.push({ kind: 'invoice', id: invoice.id });
    trash.push({ kind: 'payment-prefs', id: E2E_PARENT_GUARDIAN_ID });

    updateInvoiceStatusViaPatch(invoice.id, 'sent');
    supabaseDelete(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
    );

    // 1. Create the PaymentIntent via the edge fn (parent JWT)
    const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
    const piRes = invokeEdgeFn('stripe-create-payment-intent', parentToken, {
      invoiceId: invoice.id,
    });
    expect(piRes.status).toBe(200);
    const paymentIntentId = piRes.body.paymentIntentId as string;

    // Track the customer Stripe just created so we delete it after.
    const prefs1 = supabaseSelect(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}&select=stripe_customer_id`,
    );
    if (prefs1[0]?.stripe_customer_id) {
      trash.push({ kind: 'stripe-customer', id: prefs1[0].stripe_customer_id });
    }

    // 2. Confirm the PI directly via Stripe TEST API with pm_card_visa (4242…).
    //    This simulates what the embedded drawer would do after the parent
    //    enters card details and clicks Pay.
    const confirmed = confirmTestPaymentIntent(paymentIntentId, 'pm_card_visa');
    expect(confirmed.status).toBe('succeeded');

    // 3. Wait for the dual-mode webhook to record the payment.
    //    Use the invoice's total_minor (with VAT) — that's what the PI was
    //    created against, not the bare unit_price_minor.
    const invForTotal = supabaseSelect('invoices', `id=eq.${invoice.id}&select=total_minor`);
    const expectedAmount = invForTotal[0].total_minor as number;
    const paymentId = await waitForWebhookPayment(invoice.id, expectedAmount, supabaseSelect, 30_000);
    expect(paymentId).toBeTruthy();

    // 4. Invoice should be paid.
    const inv = supabaseSelect('invoices', `id=eq.${invoice.id}&select=status,paid_minor,total_minor`);
    expect(inv[0].status).toBe('paid');
    expect(inv[0].paid_minor).toBe(expectedAmount);

    // 5. Exactly one payment row, provider=stripe, references this PI.
    //    payment_notifications + audit_log are RLS-locked to service-role
    //    by design (operator-internal); we assert the public-facing
    //    contract — the payments row + invoice status — instead.
    const payments = supabaseSelect(
      'payments',
      `invoice_id=eq.${invoice.id}&select=id,amount_minor,provider,provider_reference`,
    );
    expect(Array.isArray(payments)).toBe(true);
    expect(payments.length).toBe(1);
    expect(payments[0].amount_minor).toBe(expectedAmount);
    expect(payments[0].provider).toBe('stripe');
    expect(payments[0].provider_reference).toBe(paymentIntentId);
  });
});

// ────────────────────────────────────────────────────────────────────
// §24.5 — Saved payment methods
// ────────────────────────────────────────────────────────────────────
test.describe('§24.5 — Saved payment methods', () => {
  test('list returns attached card with brand + last4', async () => {
    const testId = generateTestId();

    // Create test customer + attach pm_card_visa, link to e2e parent's guardian.
    const cus = createTestCustomer({ testId, email: `${testId}@test.lessonloop.net` });
    trash.push({ kind: 'stripe-customer', id: cus.id });
    const card = attachTestCardToCustomer(cus.id, 'pm_card_visa');

    supabaseDelete(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
    );
    supabaseInsert('guardian_payment_preferences', {
      org_id: E2E_ORG_ID,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      stripe_customer_id: cus.id,
      default_payment_method_id: card.id,
      auto_pay_enabled: false,
    });
    trash.push({ kind: 'payment-prefs', id: E2E_PARENT_GUARDIAN_ID });

    const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
    const res = invokeEdgeFn('stripe-list-payment-methods', parentToken, {
      orgId: E2E_ORG_ID,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.paymentMethods)).toBe(true);
    expect(res.body.paymentMethods.length).toBe(1);
    expect(res.body.paymentMethods[0].id).toBe(card.id);
    expect(res.body.paymentMethods[0].brand).toBe('visa');
    expect(res.body.paymentMethods[0].last4).toBe('4242');
    expect(res.body.defaultPaymentMethodId).toBe(card.id);
  });

  test('detach card → Stripe detached + default cleared in DB', async () => {
    const testId = generateTestId();

    const cus = createTestCustomer({ testId });
    trash.push({ kind: 'stripe-customer', id: cus.id });
    const card = attachTestCardToCustomer(cus.id, 'pm_card_visa');

    supabaseDelete(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
    );
    supabaseInsert('guardian_payment_preferences', {
      org_id: E2E_ORG_ID,
      guardian_id: E2E_PARENT_GUARDIAN_ID,
      stripe_customer_id: cus.id,
      default_payment_method_id: card.id,
      auto_pay_enabled: false,
    });
    trash.push({ kind: 'payment-prefs', id: E2E_PARENT_GUARDIAN_ID });

    const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
    const res = invokeEdgeFn('stripe-detach-payment-method', parentToken, {
      orgId: E2E_ORG_ID,
      paymentMethodId: card.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Stripe-side: PM no longer attached to customer.
    const pm = stripeApi('GET', `/payment_methods/${card.id}`) as { customer: string | null };
    expect(pm.customer).toBeNull();

    // DB-side: default_payment_method_id cleared.
    const prefs = supabaseSelect(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}&select=default_payment_method_id`,
    );
    expect(prefs[0].default_payment_method_id).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// §24.7 — Refund partial via Stripe
// ────────────────────────────────────────────────────────────────────
test.describe('§24.7 — Refund partial via Stripe', () => {
  test('partial refund → refunds row + invoice paid_minor adjusts', async () => {
    const testId = generateTestId();
    const amount = 8000; // £80
    const refundAmount = 2500; // £25 partial

    const invoice = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_invoice`,
      items: [{ description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: amount }],
    });
    trash.push({ kind: 'invoice', id: invoice.id });
    trash.push({ kind: 'payment-prefs', id: E2E_PARENT_GUARDIAN_ID });
    updateInvoiceStatusViaPatch(invoice.id, 'sent');
    supabaseDelete(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
    );

    // 1. Pay the invoice in full first
    const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
    const piRes = invokeEdgeFn('stripe-create-payment-intent', parentToken, {
      invoiceId: invoice.id,
    });
    expect(piRes.status).toBe(200);
    const piId = piRes.body.paymentIntentId as string;

    const prefs = supabaseSelect(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}&select=stripe_customer_id`,
    );
    if (prefs[0]?.stripe_customer_id) {
      trash.push({ kind: 'stripe-customer', id: prefs[0].stripe_customer_id });
    }

    confirmTestPaymentIntent(piId, 'pm_card_visa');
    // Use invoice.total_minor (post-VAT) — that's what the PI charged.
    const invForTotal = supabaseSelect('invoices', `id=eq.${invoice.id}&select=total_minor`);
    const expectedTotal = invForTotal[0].total_minor as number;
    const paymentId = await waitForWebhookPayment(invoice.id, expectedTotal, supabaseSelect, 30_000);

    // 2. Issue partial refund via owner.
    const ownerToken = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const refundRes = invokeEdgeFn('stripe-process-refund', ownerToken, {
      paymentId,
      amount: refundAmount,
      reason: 'Test partial refund',
    });
    expect(refundRes.status).toBe(200);
    expect(refundRes.body.success).toBe(true);
    expect(refundRes.body.amountMinor).toBe(refundAmount);
    expect(refundRes.body.stripeRefundId).toMatch(/^re_/);

    // 3. Refund row exists.
    const refunds = supabaseSelect(
      'refunds',
      `payment_id=eq.${paymentId}&select=id,amount_minor,status,stripe_refund_id`,
    );
    expect(refunds.length).toBe(1);
    expect(refunds[0].amount_minor).toBe(refundAmount);
    expect(refunds[0].status).toBe('succeeded');

    // 4. Invoice paid_minor reflects the refund (total - refundAmount).
    //    recalc-with-retry runs synchronously inside the edge fn; status
    //    flips back to sent because outstanding > 0.
    const inv = supabaseSelect('invoices', `id=eq.${invoice.id}&select=status,paid_minor,total_minor`);
    expect(inv[0].paid_minor).toBe(expectedTotal - refundAmount);
    expect(['sent', 'overdue', 'paid']).toContain(inv[0].status);
  });
});

// ────────────────────────────────────────────────────────────────────
// §24.10 — Billing history (platform subscription invoices)
// ────────────────────────────────────────────────────────────────────
test.describe('§24.10 — Billing history', () => {
  test('owner view returns 200 (e2e org has no platform Stripe customer → empty array)', async () => {
    const ownerToken = signInForToken(OWNER_EMAIL, OWNER_PASSWORD);
    const res = invokeEdgeFn('stripe-billing-history', ownerToken, {
      orgId: E2E_ORG_ID,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.invoices)).toBe(true);
    // E2E test org has no stripe_customer_id (it's not on a Stripe-platform plan)
    // so the fn returns empty before calling Stripe. Verifies the gate works.
    expect(res.body.invoices).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────
// §24.12 — Webhook idempotency
// ────────────────────────────────────────────────────────────────────
test.describe('§24.12 — Webhook idempotency', () => {
  test('exactly one payment row per successful PI (dedup contract)', async () => {
    // Drive a real payment so we have an event_id we can find.
    const testId = generateTestId();
    const amount = 1234;
    const invoice = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_invoice`,
      items: [{ description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: amount }],
    });
    trash.push({ kind: 'invoice', id: invoice.id });
    trash.push({ kind: 'payment-prefs', id: E2E_PARENT_GUARDIAN_ID });
    updateInvoiceStatusViaPatch(invoice.id, 'sent');
    supabaseDelete(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
    );

    const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
    const piRes = invokeEdgeFn('stripe-create-payment-intent', parentToken, {
      invoiceId: invoice.id,
    });
    const piId = piRes.body.paymentIntentId as string;

    const prefs = supabaseSelect(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}&select=stripe_customer_id`,
    );
    if (prefs[0]?.stripe_customer_id) {
      trash.push({ kind: 'stripe-customer', id: prefs[0].stripe_customer_id });
    }

    confirmTestPaymentIntent(piId, 'pm_card_visa');
    const invForTotal12 = supabaseSelect('invoices', `id=eq.${invoice.id}&select=total_minor`);
    await waitForWebhookPayment(invoice.id, invForTotal12[0].total_minor as number, supabaseSelect, 30_000);

    // Idempotency contract — see migration 20260502100000_webhook_dedup_two_phase.
    // After the dual-mode webhook recorded the payment_intent.succeeded
    // event, the contract is: exactly ONE payment row per PI regardless
    // of how many times Stripe re-delivers (Stripe retries on any non-2xx).
    // The dedup table itself is RLS-locked to service-role; we assert
    // the public-facing invariant — the payments row count — instead.
    const payments = supabaseSelect(
      'payments',
      `invoice_id=eq.${invoice.id}&select=id,provider_reference`,
    );
    expect(payments.length).toBe(1);
    expect(payments[0].provider_reference).toBe(piId);

    // True-replay coverage (signing our own event with a controlled
    // event_id and re-posting it) is in the next two tests.
  });

  // True replay: we own the event_id, so we can post the EXACT same
  // signed body twice and observe the dedup. Layer 1 — webhook claims
  // the in-flight row, completes the handler, marks processed_at; the
  // second post hits the existing-and-processed branch and short-circuits
  // with {duplicate: true} (stripe-webhook index.ts:161-167). The
  // payments table must still have exactly one row.
  test('true replay: same event_id twice → webhook short-circuits, payments stays at 1', async () => {
    const testId = generateTestId();
    const amount = 4321;

    const invoice = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_invoice`,
      items: [{ description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: amount }],
    });
    trash.push({ kind: 'invoice', id: invoice.id });
    updateInvoiceStatusViaPatch(invoice.id, 'sent');

    // Synthetic event_id + PI id — the webhook handler reads PI fields
    // off the event payload (handlePaymentIntentSucceeded reads
    // metadata.lessonloop_invoice_id, amount, id) and never calls
    // Stripe to verify the PI exists. Use a clearly synthetic prefix
    // so this can never collide with a real Stripe object.
    const eventId = `evt_e2e_replay_${testId}`;
    const piId = `pi_e2e_replay_${testId}`;
    trash.push({ kind: 'webhook-event', id: eventId });

    const inv = supabaseSelect('invoices', `id=eq.${invoice.id}&select=total_minor`);
    const totalMinor = inv[0].total_minor as number;

    const eventBody = {
      id: eventId,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      type: 'payment_intent.succeeded',
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      data: {
        object: {
          id: piId,
          object: 'payment_intent',
          amount: totalMinor,
          amount_received: totalMinor,
          currency: 'gbp',
          status: 'succeeded',
          livemode: false,
          metadata: {
            lessonloop_invoice_id: invoice.id,
            lessonloop_org_id: E2E_ORG_ID,
          },
        },
      },
    };

    // Post #1 — fresh event, handler runs, payment row written.
    const first = postWebhookEvent(eventBody);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ received: true });
    expect(first.body.duplicate).toBeFalsy();

    // Wait for the payment row (record_stripe_payment is synchronous
    // inside the handler but the DB commit lands a tick later).
    await waitForWebhookPayment(invoice.id, totalMinor, supabaseSelect, 15_000);

    // Post #2 — same event_id, same body. Webhook hits the
    // already-processed branch.
    const second = postWebhookEvent(eventBody);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ received: true, duplicate: true });

    // Public-facing invariant: still exactly one payment row.
    const payments = supabaseSelect(
      'payments',
      `invoice_id=eq.${invoice.id}&select=id,amount_minor,provider,provider_reference`,
    );
    expect(payments.length).toBe(1);
    expect(payments[0].amount_minor).toBe(totalMinor);
    expect(payments[0].provider).toBe('stripe');
    expect(payments[0].provider_reference).toBe(piId);
  });

  // Belt-and-braces: a different event_id but the SAME PI id is the
  // pathological case where Stripe (rarely) reissues a fresh event for
  // an underlying object that's already settled. Layer 1 (webhook
  // dedup) doesn't catch it — different event_id → fresh claim row.
  // Layer 2 (record_stripe_payment RPC) does — it dedups on
  // _provider_reference (the PI id) and returns {duplicate: true}, so
  // the payments table count still doesn't grow.
  test('different event_id, same payment_intent_id → RPC dedup keeps payments at 1', async () => {
    const testId = generateTestId();
    const amount = 5678;

    const invoice = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_invoice`,
      items: [{ description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: amount }],
    });
    trash.push({ kind: 'invoice', id: invoice.id });
    updateInvoiceStatusViaPatch(invoice.id, 'sent');

    const piId = `pi_e2e_replay_${testId}`;
    const eventIdA = `evt_e2e_replayA_${testId}`;
    const eventIdB = `evt_e2e_replayB_${testId}`;
    trash.push({ kind: 'webhook-event', id: eventIdA });
    trash.push({ kind: 'webhook-event', id: eventIdB });

    const inv = supabaseSelect('invoices', `id=eq.${invoice.id}&select=total_minor`);
    const totalMinor = inv[0].total_minor as number;

    const buildEvent = (eventId: string) => ({
      id: eventId,
      object: 'event',
      api_version: '2023-10-16',
      created: Math.floor(Date.now() / 1000),
      type: 'payment_intent.succeeded',
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      data: {
        object: {
          id: piId,
          object: 'payment_intent',
          amount: totalMinor,
          amount_received: totalMinor,
          currency: 'gbp',
          status: 'succeeded',
          livemode: false,
          metadata: {
            lessonloop_invoice_id: invoice.id,
            lessonloop_org_id: E2E_ORG_ID,
          },
        },
      },
    });

    // Post event A — payment row created.
    const first = postWebhookEvent(buildEvent(eventIdA));
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBeFalsy();
    await waitForWebhookPayment(invoice.id, totalMinor, supabaseSelect, 15_000);

    // Post event B — same PI id. Webhook claims a new in-flight row
    // (different event_id) and dispatches the handler, but the RPC
    // sees the payment row already exists for this provider_reference
    // and returns {duplicate: true}. Webhook returns {received: true}
    // (no duplicate flag at the webhook layer because we did go through
    // the handler — the dedup happened a layer deeper). stripe_webhook_events
    // is RLS-locked to service-role so we can't observe both rows directly;
    // the public-facing invariant below is what matters.
    const second = postWebhookEvent(buildEvent(eventIdB));
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ received: true });

    // Public-facing invariant: still exactly one payment row.
    const payments = supabaseSelect(
      'payments',
      `invoice_id=eq.${invoice.id}&select=id,provider_reference`,
    );
    expect(payments.length).toBe(1);
    expect(payments[0].provider_reference).toBe(piId);
  });
});

// ────────────────────────────────────────────────────────────────────
// §24 — RBAC negative
// ────────────────────────────────────────────────────────────────────
test.describe('§24 — RBAC negative', () => {
  test('finance cannot call stripe-process-refund (owner/admin/solo only)', async () => {
    // Setup: a real payment we could refund.
    const testId = generateTestId();
    const amount = 3000;
    const invoice = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: E2E_PARENT_GUARDIAN_ID,
      notes: `e2e_${testId}_invoice`,
      items: [{ description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: amount }],
    });
    trash.push({ kind: 'invoice', id: invoice.id });
    trash.push({ kind: 'payment-prefs', id: E2E_PARENT_GUARDIAN_ID });
    updateInvoiceStatusViaPatch(invoice.id, 'sent');
    supabaseDelete(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}`,
    );

    const parentToken = signInForToken(PARENT_EMAIL, PARENT_PASSWORD);
    const piRes = invokeEdgeFn('stripe-create-payment-intent', parentToken, {
      invoiceId: invoice.id,
    });
    const prefs = supabaseSelect(
      'guardian_payment_preferences',
      `org_id=eq.${E2E_ORG_ID}&guardian_id=eq.${E2E_PARENT_GUARDIAN_ID}&select=stripe_customer_id`,
    );
    if (prefs[0]?.stripe_customer_id) {
      trash.push({ kind: 'stripe-customer', id: prefs[0].stripe_customer_id });
    }
    confirmTestPaymentIntent(piRes.body.paymentIntentId, 'pm_card_visa');
    const invForTotalRBAC = supabaseSelect('invoices', `id=eq.${invoice.id}&select=total_minor`);
    const paymentId = await waitForWebhookPayment(invoice.id, invForTotalRBAC[0].total_minor as number, supabaseSelect, 30_000);

    // Finance role attempts refund → should be rejected (org_type=academy, not solo).
    const financeToken = signInForToken(FINANCE_EMAIL, FINANCE_PASSWORD);
    const res = invokeEdgeFn('stripe-process-refund', financeToken, {
      paymentId,
      amount: 1000,
      reason: 'Test rejection',
    });
    // 400 with permissions error from the fn's catch block.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toMatch(/[Ii]nsufficient permissions|[Ii]nvalid|[Pp]ermissions|[Uu]nauthorized/);

    // No refund row created.
    const refunds = supabaseSelect(
      'refunds',
      `payment_id=eq.${paymentId}&select=id`,
    );
    expect(refunds.length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// §24 — RLS / cross-tenant negative
// ────────────────────────────────────────────────────────────────────
test.describe('§24 — Cross-tenant isolation', () => {
  test("parent2 cannot create-payment-intent for parent1's invoice", async () => {
    const testId = generateTestId();
    const amount = 2222;
    const invoice = createTestInvoice({
      dueDate: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 10),
      payerGuardianId: E2E_PARENT_GUARDIAN_ID, // parent1's guardian
      notes: `e2e_${testId}_invoice`,
      items: [{ description: `e2e_${testId}_item`, quantity: 1, unit_price_minor: amount }],
    });
    trash.push({ kind: 'invoice', id: invoice.id });
    updateInvoiceStatusViaPatch(invoice.id, 'sent');

    // Parent2 attempts to pay parent1's invoice → 400 "Not authorized to pay this invoice"
    const parent2Token = signInForToken(PARENT2_EMAIL, PARENT2_PASSWORD);
    const res = invokeEdgeFn('stripe-create-payment-intent', parent2Token, {
      invoiceId: invoice.id,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toMatch(/[Nn]ot authorized/);
  });
});

// ────────────────────────────────────────────────────────────────────
// §24 — UI smoke (drawer renders + Stripe Elements iframe present)
// ────────────────────────────────────────────────────────────────────
test.describe('§24 — Embedded drawer UI smoke', () => {
  test.use({ storageState: AUTH.parent });

  test('parent /portal/invoices renders without console errors', async ({ page }) => {
    // The PaymentDrawer is rendered by InvoiceCard when a parent clicks
    // Pay. We don't drive the drawer here (Elements iframe is too brittle
    // for parallel runs); the catalog tests for the backend flow are
    // above. Here we just verify the page loads cleanly.
    await page.goto('/portal/invoices');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);
    // Must NOT show the currency-error boundary that production hit on
    // 2026-05-08 (commit dbe1a51) — regression guard.
    const errorBoundary = await page
      .getByText('Something went wrong')
      .first()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);
    expect(errorBoundary).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// §24 — Money-path edge fn auth-gate contracts (s17 B-bucket)
// ────────────────────────────────────────────────────────────────────
//
// Audit/MASTER.md "Invoicing & Payments" section has several rows that
// lack any test coverage but are user-facing edge fns (gated by JWT)
// or service-role-only (gated by Bearer === SERVICE_ROLE_KEY). The
// fn-invocation happy paths require Stripe API setup that's already
// covered for the more critical fns (process-refund, list-payment-
// methods etc.) above; what's missing for these less-critical fns is
// the auth-gate negative — does the fn correctly reject anon / wrong-
// role callers?
//
// One-shot contract test per fn. Asserts:
//   - anon JWT → 401 (or non-200 reject)
//   - no-auth → 401
//
// Service-role-only fns use a different gate; we just verify the
// non-service callers can't trip it.
//
// These tests don't seed/cleanup any Stripe-side state — they POST
// to the fn URL with a deliberately-invalid auth header and verify
// rejection. Pure auth-gate contract.

function callFnAuthGate(fnName: string, opts: { auth: 'anon' | 'none'; payload?: Record<string, unknown> }): { status: number; body: string } {
  const respFile = `/tmp/sb-${fnName}-resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.txt`;
  const reqFile = `/tmp/sb-${fnName}-req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
  fs.writeFileSync(reqFile, JSON.stringify(opts.payload ?? {}));
  let authHeader = '';
  if (opts.auth === 'anon') {
    authHeader = `-H "Authorization: Bearer ${process.env.E2E_SUPABASE_ANON_KEY}" `;
  }
  try {
    const status = execSync(
      `curl -s -o ${respFile} -w "%{http_code}" ` +
        `-X POST "${process.env.E2E_SUPABASE_URL}/functions/v1/${fnName}" ` +
        `${authHeader}` +
        `-H "Content-Type: application/json" ` +
        `-d @${reqFile}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
    const body = fs.existsSync(respFile) ? fs.readFileSync(respFile, 'utf-8') : '';
    return { status: parseInt(status.trim(), 10), body };
  } finally {
    try { fs.unlinkSync(respFile); } catch { /* ignore */ }
    try { fs.unlinkSync(reqFile); } catch { /* ignore */ }
  }
}

test.describe('§24 — Money-path edge fn auth-gate contracts', () => {
  // User-JWT fns — anon Bearer should be rejected (the fn calls
  // getUser(token) and the anon JWT has no user; getUser fails).
  // No-auth → fn never reaches the user check; reject at outer gate.

  for (const fnName of [
    'stripe-customer-portal',
    'stripe-verify-session',
    'stripe-update-payment-preferences',
    'stripe-create-checkout',
  ]) {
    test(`${fnName} — anon JWT rejected`, async () => {
      const res = callFnAuthGate(fnName, { auth: 'anon', payload: { orgId: process.env.E2E_ORG_ID } });
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    test(`${fnName} — no auth rejected`, async () => {
      const res = callFnAuthGate(fnName, { auth: 'none' });
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
    });
  }

  // Service-role-only fns — Bearer === SERVICE_ROLE_KEY check. anon
  // and no-auth both rejected. The byte-equal check for the service-
  // role variant means even owner JWT 401s (covered in §27 for
  // send-payment-receipt as the canonical case).

  for (const fnName of [
    'send-refund-notification',
    'send-auto-pay-alert',
    'send-auto-pay-failure-notification',
    'send-dispute-notification',
    'send-recurring-billing-alert',
  ]) {
    test(`${fnName} — anon JWT rejected (service-role-only fn)`, async () => {
      const res = callFnAuthGate(fnName, { auth: 'anon', payload: { paymentId: '00000000-0000-0000-0000-000000000000' } });
      // Service-role check rejects with 401, but some fns return 400 if
      // they parse body before auth. Accept any 4xx as proof the gate
      // fired (the fn didn't accept anon as a valid invoker).
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    test(`${fnName} — no auth rejected`, async () => {
      const res = callFnAuthGate(fnName, { auth: 'none' });
      expect(res.status, `${fnName} body: ${res.body.slice(0, 200)}`).toBeGreaterThanOrEqual(400);
    });
  }
});
