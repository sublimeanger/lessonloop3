/**
 * Stripe test-mode helpers for §24 E2E tests.
 *
 * The e2e org (25b57950-…) has organisations.stripe_test_mode = true,
 * so every Stripe edge function for that org routes through
 * STRIPE_TEST_SECRET_KEY (configured as a Supabase secret). This file
 * exposes utility functions to drive the test-mode Stripe API directly
 * (creating customers, attaching test cards, simulating PaymentIntents)
 * so tests don't have to drive Stripe Elements iframes — too brittle.
 *
 * The infra was wired up in commits b7900ab → 2bf0aea; see the
 * stripe-client.ts module docstring for the dispatch contract.
 *
 * NEVER use this file with the live key. The hardcoded fallback to
 * E2E_STRIPE_TEST_SECRET ensures we always hit test-mode Stripe.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import { createHmac, randomBytes } from 'crypto';

const STRIPE_API = 'https://api.stripe.com/v1';

export function getStripeTestSecret(): string {
  const key = process.env.E2E_STRIPE_TEST_SECRET || process.env.STRIPE_TEST_SECRET_KEY;
  if (!key || !key.startsWith('sk_test_')) {
    throw new Error(
      `E2E_STRIPE_TEST_SECRET must be set to an sk_test_... key (got ${key?.slice(0, 7) || 'undefined'}…)`
    );
  }
  return key;
}

/** Run a curl against Stripe's API. Returns parsed JSON; throws on Stripe error. */
export function stripeApi(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, string | number | boolean>,
): Record<string, unknown> {
  const key = getStripeTestSecret();
  const tmpFile = `/tmp/stripe-test-${Date.now()}-${randomBytes(4).toString('hex')}.txt`;

  let dataArgs = '';
  if (body) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(body)) {
      parts.push(`--data-urlencode ${JSON.stringify(`${k}=${String(v)}`)}`);
    }
    dataArgs = parts.join(' ');
  }

  try {
    const cmd = `curl -s -X ${method} "${STRIPE_API}${path}" -u "${key}:" ${dataArgs}`;
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 20_000, maxBuffer: 4 * 1024 * 1024 });
    fs.writeFileSync(tmpFile, result);
    const parsed = JSON.parse(result);
    if (parsed.error) {
      throw new Error(
        `Stripe API ${method} ${path} → ${parsed.error.type ?? 'error'}: ${parsed.error.message}`
      );
    }
    return parsed;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Create a Stripe TEST customer. Always livemode: false — caller must
 * verify in returned object if they care.
 */
export function createTestCustomer(opts: {
  email?: string;
  name?: string;
  testId: string;
  metadata?: Record<string, string>;
}): { id: string; email?: string } {
  const meta = opts.metadata ?? {};
  meta.lessonloop_e2e_test_id = opts.testId;
  const body: Record<string, string> = {
    email: opts.email ?? `${opts.testId}@test.lessonloop.net`,
    name: opts.name ?? `E2E Customer ${opts.testId}`,
  };
  for (const [k, v] of Object.entries(meta)) {
    body[`metadata[${k}]`] = v;
  }
  const cus = stripeApi('POST', '/customers', body) as { id: string; email?: string };
  return { id: cus.id, email: cus.email };
}

/** Attach a saved test PM to a customer. Uses Stripe's pre-attached test PM tokens. */
export function attachTestCardToCustomer(
  customerId: string,
  paymentMethod: 'pm_card_visa' | 'pm_card_mastercard' | 'pm_card_chargeDeclined' = 'pm_card_visa',
): { id: string; brand: string; last4: string } {
  // Note: Stripe test PMs starting with pm_card_* are special static IDs
  // that exist in every test account. Attach them directly.
  const attached = stripeApi('POST', `/payment_methods/${paymentMethod}/attach`, {
    customer: customerId,
  }) as { id: string; card?: { brand: string; last4: string } };
  return {
    id: attached.id,
    brand: attached.card?.brand ?? 'unknown',
    last4: attached.card?.last4 ?? '****',
  };
}

/** Delete a Stripe test customer (idempotent — swallow already-deleted). */
export function deleteTestCustomer(customerId: string): void {
  if (!customerId) return;
  try {
    stripeApi('DELETE', `/customers/${customerId}`);
  } catch (err) {
    // Stripe surfaces "No such customer" or 404 for already-deleted; both fine.
    const msg = String(err);
    if (msg.includes('404') || msg.includes('No such customer') || msg.includes('resource_missing')) {
      return;
    }
    // eslint-disable-next-line no-console
    console.warn(`[stripe-test-helpers] deleteTestCustomer ${customerId}:`, err);
  }
}

/**
 * Confirm a PaymentIntent off-session with a saved test PM. Used to
 * simulate the "parent pays via embedded drawer" flow without driving
 * Stripe Elements in Playwright (which is brittle — iframe origin,
 * autofill races, etc).
 */
export function confirmTestPaymentIntent(
  paymentIntentId: string,
  paymentMethod = 'pm_card_visa',
): { id: string; status: string; charges?: unknown } {
  return stripeApi('POST', `/payment_intents/${paymentIntentId}/confirm`, {
    payment_method: paymentMethod,
    return_url: 'https://app.lessonloop.net/portal/invoices?payment=test',
  }) as { id: string; status: string; charges?: unknown };
}

/** Retrieve a PaymentIntent (verifies test mode by checking livemode). */
export function getTestPaymentIntent(paymentIntentId: string): {
  id: string;
  status: string;
  amount: number;
  currency: string;
  livemode: boolean;
  charges?: { data: Array<{ id: string }> };
  latest_charge?: string;
} {
  const pi = stripeApi('GET', `/payment_intents/${paymentIntentId}`) as {
    id: string;
    status: string;
    amount: number;
    currency: string;
    livemode: boolean;
    charges?: { data: Array<{ id: string }> };
    latest_charge?: string;
  };
  if (pi.livemode === true) {
    throw new Error(
      `[stripe-test-helpers] PI ${paymentIntentId} returned livemode=true — secret leaked into test code`
    );
  }
  return pi;
}

/**
 * Move an invoice to a target status via direct PATCH (service-role).
 *
 * The catalog references an `update_invoice_status` RPC that doesn't
 * actually exist in the schema (only `enforce_invoice_status_transition`
 * trigger does). Tests need to flip draft → sent so the parent-pay
 * fns accept the invoice; service-role PATCH is the supported path.
 *
 * The status_transition trigger validates the move (draft→sent OK).
 * If we ever need a sequence (e.g. draft→void), call this helper once
 * per step.
 */
export function updateInvoiceStatusViaPatch(invoiceId: string, status: string): void {
  const url = process.env.E2E_SUPABASE_URL!;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error('E2E_SUPABASE_SERVICE_ROLE_KEY required for updateInvoiceStatusViaPatch');
  const tmp = `/tmp/sb-patch-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(tmp, JSON.stringify({ status }));
  try {
    execSync(
      `curl -s -X PATCH "${url}/rest/v1/invoices?id=eq.${invoiceId}" ` +
        `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" ` +
        `-H "Content-Type: application/json" -H "Prefer: return=minimal" -d @${tmp}`,
      { encoding: 'utf-8', timeout: 15_000 },
    );
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

/**
 * Reset rate-limit rows for known E2E users. Called in beforeAll so
 * a long test run (or a series of debugging reruns) doesn't 429 us
 * on stripe-create-checkout, stripe-process-refund etc — which all
 * have hourly per-user caps that would otherwise stall the suite.
 *
 * Service-role only. No-op if the key isn't configured.
 */
export function resetE2ERateLimits(): void {
  const url = process.env.E2E_SUPABASE_URL!;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) return;
  // Pull e2e user IDs by email pattern then nuke their rate_limits rows.
  // Done as one execute_sql equivalent via PostgREST sub-select doesn't
  // work for DELETE — easier to do two requests.
  const emails = [
    'e2e-owner@test.lessonloop.net',
    'e2e-admin@test.lessonloop.net',
    'e2e-finance@test.lessonloop.net',
    'e2e-teacher@test.lessonloop.net',
    'e2e-parent@test.lessonloop.net',
    'e2e-parent2@test.lessonloop.net',
  ];
  // auth.users isn't exposed via PostgREST by default; query profiles which mirrors user IDs.
  const profiles = execSync(
    `curl -s "${url}/rest/v1/profiles?email=in.(${emails.map(encodeURIComponent).join(',')})&select=id" ` +
      `-H "apikey: ${key}" -H "Authorization: Bearer ${key}"`,
    { encoding: 'utf-8', timeout: 10_000 },
  );
  let ids: string[] = [];
  try { ids = (JSON.parse(profiles) as Array<{ id: string }>).map((p) => p.id); } catch { /* ignore */ }
  if (ids.length === 0) return;
  execSync(
    `curl -s -X DELETE "${url}/rest/v1/rate_limits?user_id=in.(${ids.join(',')})" ` +
      `-H "apikey: ${key}" -H "Authorization: Bearer ${key}" -H "Prefer: return=minimal"`,
    { encoding: 'utf-8', timeout: 10_000 },
  );
}

/**
 * Sign + POST a synthetic Stripe event directly to the deployed
 * stripe-webhook edge fn. Used by §24.12 true-replay idempotency tests
 * where we need to control event_id and re-deliver the exact same payload
 * — Stripe doesn't expose a "redeliver this event" API to API callers.
 *
 * Signature scheme matches Stripe's: HMAC-SHA256 of `{ts}.{body}` with
 * the test webhook secret as key, header
 * `Stripe-Signature: t=<ts>,v1=<hex>`. Webhook verifies via
 * `constructEventAsync(body, sig, STRIPE_TEST_WEBHOOK_SECRET)` (test
 * secret is tried first in the dual-mode handler, see stripe-webhook
 * index.ts:71-81). Body bytes signed and POSTed must be byte-identical;
 * we serialise once and reuse.
 *
 * Returns { status, body }. body is parsed JSON or raw text on
 * non-JSON response. Caller is responsible for cleaning up
 * `stripe_webhook_events` rows by event_id (TTL cron will eventually
 * sweep, but explicit cleanup keeps the table small).
 */
export function postWebhookEvent(eventBody: Record<string, unknown>): { status: number; body: any } {
  const secret = process.env.E2E_STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_TEST_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith('whsec_')) {
    throw new Error(
      `E2E_STRIPE_TEST_WEBHOOK_SECRET must be a whsec_... value (got ${secret?.slice(0, 6) || 'undefined'}…)`,
    );
  }
  const url = process.env.E2E_SUPABASE_URL;
  if (!url) throw new Error('E2E_SUPABASE_URL required for postWebhookEvent');

  const body = JSON.stringify(eventBody);
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  const stripeSignature = `t=${ts},v1=${sig}`;

  const tmpFile = `/tmp/wh-event-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
  fs.writeFileSync(tmpFile, body);
  try {
    const result = execSync(
      `curl -s -w "\\nHTTP:%{http_code}" -X POST "${url}/functions/v1/stripe-webhook" ` +
        `-H "stripe-signature: ${stripeSignature}" ` +
        `-H "Content-Type: application/json" -d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
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

/**
 * Wait for the webhook to record a payment for an invoice. Polls
 * `payments` table via the supabase admin client. Returns the payment
 * row id, or throws if not received within timeout.
 *
 * Webhooks in test mode dispatch through the test endpoint
 * (we_1TUwZhBAjFOLYDS3QGslhpbj) which the dual-mode webhook fn verifies
 * against STRIPE_TEST_WEBHOOK_SECRET. Typical latency 1-3s; we allow 30s.
 */
export async function waitForWebhookPayment(
  invoiceId: string,
  expectedAmountMinor: number,
  supabaseSelectFn: (table: string, query: string) => unknown,
  timeoutMs = 30_000,
): Promise<string> {
  const start = Date.now();
  let lastSnapshot: unknown = [];
  while (Date.now() - start < timeoutMs) {
    // payments has no `status` column (it's on invoices); just amount_minor + provider_reference.
    const raw = supabaseSelectFn(
      'payments',
      `invoice_id=eq.${invoiceId}&select=id,amount_minor,provider,provider_reference`,
    );
    const payments = Array.isArray(raw) ? raw as Array<Record<string, unknown>> : [];
    lastSnapshot = raw;
    const match = payments.find((p) => p.amount_minor === expectedAmountMinor);
    if (match) return match.id as string;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Webhook payment not received within ${timeoutMs}ms for invoice ${invoiceId}, ` +
      `expected amount ${expectedAmountMinor}. Last snapshot: ${JSON.stringify(lastSnapshot)}`,
  );
}
