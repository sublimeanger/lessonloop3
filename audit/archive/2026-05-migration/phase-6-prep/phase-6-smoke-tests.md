# Phase 6 Smoke Tests

**Purpose:** verify every critical flow works against destination before cutover. No live users, so failures are diagnostic, not catastrophic — just keep iterating until each tier is green.

**Prerequisite:** all 16 placeholder secrets replaced with real values per `secret-fetch-checklist.md`. Verify:
```bash
supabase secrets list --project-ref xmrhmxizpslhtkibqyfy | grep -E "PENDING_"
```
Should be empty.

**Test environment:** runs against `https://xmrhmxizpslhtkibqyfy.supabase.co` BEFORE cutting frontend over.

---

## Tier 1 — Auth

### T1.1 — Email/password sign-in

Pick any test user from `auth.users`. Set a fresh password via Admin API (source password hashes don't migrate):
```bash
source /tmp/dest_creds.sh
curl -X PUT \
  -H "Authorization: Bearer $DEST_SERVICE_ROLE_KEY" \
  -H "apikey: $DEST_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$DEST_URL/auth/v1/admin/users/<TEST_USER_ID>" \
  -d '{"password":"TestPass2026!"}'
```

Then sign in:
```bash
curl -X POST -H "apikey: $DEST_ANON_KEY" -H "Content-Type: application/json" \
  "$DEST_URL/auth/v1/token?grant_type=password" \
  -d '{"email":"<test-email>","password":"TestPass2026!"}'
```

**Expected:** HTTP 200 with `access_token`, `refresh_token`, `user.id`.

**Failure modes:**
- 400 `invalid_credentials` → password not set correctly
- 500 → check function logs

---

### T1.2 — Google OAuth sign-in

Browser test:
```
https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://app.lessonloop.net/login
```

Should bounce to `accounts.google.com/o/oauth2/v2/auth?...&client_id=<source's GOOGLE_CLIENT_ID>` then back to `https://app.lessonloop.net/login#access_token=...`.

**Failure modes:**
- `redirect_uri_mismatch` → destination callback not in Google Cloud Console authorized list
- `invalid_client` → `external_google_client_id` empty in destination Auth config
- Lands at source's URL → `site_url` not set on destination

---

### T1.3 — Password reset email

```bash
curl -X POST -H "apikey: $DEST_ANON_KEY" -H "Content-Type: application/json" \
  "$DEST_URL/auth/v1/recover" \
  -d '{"email":"<your-email>"}'
```

**Expected:** HTTP 200; email arrives within 60s, branded as LessonLoop, link points to destination's verify endpoint.

**Failure modes:**
- No email after 5 min → SMTP misconfigured
- Email arrives unbranded → templates not copied from source
- Link broken → `site_url` wrong

---

### T1.4 — Magic link

```bash
curl -X POST -H "apikey: $DEST_ANON_KEY" -H "Content-Type: application/json" \
  "$DEST_URL/auth/v1/magiclink" \
  -d '{"email":"<your-email>"}'
```

Same expectations + failure modes as T1.3.

---

## Tier 2 — Payments

### T2.0 — Stripe MCP recon (✅ done 2026-05-07)

Verified via MCP + direct Stripe API:
- Account: `acct_1SrzbkAzPfYm94ux` (LessonLoop), live mode
- Products: 3 (Teacher / Studio / Agency), pricing structure ✓
- 6 Price IDs match destination secrets by SHA256 (see T2.1 results)
- Source webhook: `https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/stripe-webhook`, 6 enabled events:
  `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- These 6 events are the exact list to register on destination at cutover Step 5.

### T2.1 — `stripe-subscription-checkout` end-to-end (✅ done 2026-05-07, 6/6 PASS)

Tested all 6 plan × interval combinations against destination using `demo-solo-owner@lessonloop.test` JWT. Each call:
1. POST to `stripe-subscription-checkout` returned HTTP 200 with valid Stripe Checkout URL
2. Session retrieved via direct Stripe API verified:
   - `line_items[].price.id` matches the corresponding `STRIPE_PRICE_*` secret
   - `metadata.lessonloop_org_id` = caller's org
   - `mode = 'subscription'`, `status = 'open'`, `livemode = true`
3. All 6 sessions expired post-test for cleanup

Stripe customer `cus_UTM8UaqtrlyJ6Z` was created and persisted to `organisations.stripe_customer_id` for org `46b20ac7-…`. Acceptable test residue; can be reset during Phase 8 cleanup if desired.

### T2.2 — Stripe webhook delivery (DEFERRED to cutover Step 5)

**Decision (2026-05-07):** defer webhook signature path testing to cutover. Rationale:
- Pre-cutover dual-processing window risks real-name customer outbound notifications (e.g., `invoice.paid` triggers Resend confirmation emails)
- Webhook signature verification logic was not modified in Phase 5; Phase 5 redeploys only changed `verify_jwt = false` config, which is the gateway's path, not the function's `stripe.webhooks.constructEvent()` call
- Stripe dashboard's "Send test webhook" feature gives 30-second post-cutover validation; if it fails, rollback is fast

At cutover Step 5:
1. Register `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/stripe-webhook` with the 6 events from T2.0 recon
2. Capture the new `whsec_…` from Stripe (shown once)
3. `supabase secrets set --project-ref xmrhmxizpslhtkibqyfy STRIPE_WEBHOOK_SECRET=whsec_…`
4. Stripe dashboard → "Send test webhook" → `checkout.session.completed` → expect HTTP 200 + new row in `stripe_webhook_events`
5. Disable source's webhook (don't delete — rollback option)

### T2.3 — Subscription lifecycle (DEFERRED to cutover)

Requires real subscription state to test. Pre-cutover testing would either:
- Mutate live subscription state (unsafe with real-name customers)
- OR require synthetic test customers + destination-only state (possible but not necessary pre-cutover)

Defer entirely. At cutover, verify by running through one real subscription create/cancel via Stripe Dashboard test mode after webhook is confirmed working in T2.2.

### T2.4 — Read-only Stripe functions (✅ done 2026-05-07, 3/3 PASS)

Tested with admin user JWT (`demo-solo-owner@lessonloop.test`) against org `46b20ac7-…`:
- `stripe-list-payment-methods` → HTTP 200, `{"paymentMethods":[]}` (no PMs attached — expected for fresh test customer)
- `stripe-billing-history` → HTTP 200, `{"invoices":[]}` (no invoices yet)
- `stripe-customer-portal` → HTTP 200, returns signed `billing.stripe.com/p/session/live_…` URL (5-min expiry, harmless)

### T2.5 — DEFERRED Stripe functions (state-mutating; tested at cutover)

These functions mutate Stripe state (charges, refunds, payment method attachment, subscription updates). Not safe to test pre-cutover against live mode without scoped test data. Defer to Phase 7 cutover testing OR a separate test-mode harness:

| Function | Why deferred |
|---|---|
| `stripe-create-payment-intent` | Creates a PaymentIntent (real intent, no charge until card attached); minor test residue but reachable. Could test in isolation but no value vs. waiting for real flow. |
| `stripe-create-checkout` | Different from `stripe-subscription-checkout` — this one is for **invoice payment** (one-time, requires real invoice ID). Defer; tested as part of real invoice payment flow at cutover. |
| `stripe-process-refund` | Creates real refunds. Cannot test without a real charge to refund. Cutover-time test on a recent test charge if needed. |
| `stripe-detach-payment-method` | Removes a saved card. Requires an attached PM to detach. Cutover-time. |
| `stripe-update-payment-preferences` | Mutates `guardian_payment_preferences` table state. Could test in isolation but no value. |
| `stripe-auto-pay-installment` | Triggered by cron + idempotent; verified end-to-end via cron-job-history smoke (Tier 5). |
| `stripe-verify-session` | Reads a Checkout session's status. Used post-checkout return; tested implicitly at cutover when first real subscription is created. |
| `stripe-webhook` | Defers with T2.2 — tested at cutover Step 5. |

### Old format (replaced by T2.0–T2.5 above)
~~Use Stripe test mode...~~ (irrelevant — destination has live keys; tested via real-mode pending sessions, expired post-test)

---

## Tier 3 — Integrations

### T3.1 — Xero OAuth + invoice sync

Sign in → Settings → Integrations → Xero → "Connect to Xero". Authorize against a test Xero org.

**Expected:** redirects work; `xero_connections` row created; trigger an invoice sync → `xero_entity_mappings` row created.

**Failure modes:**
- `redirect_uri_mismatch` → callback URL not in Xero app config
- 401 from Xero → CLIENT_ID/CLIENT_SECRET wrong, or scopes missing `accounting.transactions`

---

### T3.2 — Zoom OAuth + lesson room

**Architecture quirk:** Zoom OAuth flow is **frontend-mediated**, unlike Xero/Google which redirect directly to a Supabase edge function. Zoom's app config has redirect_uri = `https://app.lessonloop.net/auth/zoom/callback` (a frontend route). The React component at `src/pages/ZoomOAuthCallback.tsx` reads `import.meta.env.VITE_SUPABASE_URL` and forwards `code+state` to `<that-URL>/functions/v1/zoom-oauth-callback`. Whichever Supabase the frontend was *built* against gets the OAuth code.

**Pre-cutover state:** the deployed `app.lessonloop.net` was built with source's `VITE_SUPABASE_URL`, so any Zoom OAuth lands at source's edge function, not destination's. Full E2E test of T3.2 is **not possible** until cutover Step 3 (frontend rebuild + redeploy with destination's URL).

#### T3.2.A.1 — `zoom-oauth-start` server-side (✅ done 2026-05-07, PASS)
Validated:
- HTTP 200, returns `{auth_url, state}`
- URL base is `https://zoom.us/oauth/authorize`, with `response_type=code`, `redirect_uri=https://app.lessonloop.net/auth/zoom/callback`, non-empty `state`
- `client_id` in URL matches stored `ZOOM_CLIENT_ID` secret by SHA256
- `state` decodes to `{user_id, org_id, nonce}` correctly

#### T3.2.A.2 — `zoom-oauth-callback` reachability (✅ done 2026-05-07, PASS)
Function ACTIVE, `verify_jwt: false`, version 10. Synthetic invocations:
- Garbage state → HTTP 400 "Invalid state parameter"
- Well-formed state + bogus code → HTTP 302 (redirect to error)
- `error=access_denied` query param → graceful redirect chain
- Zero side effects in DB (no rows in `calendar_connections`/`zoom_meeting_mappings`/`audit_log`)

#### T3.2.A.3 — Credential validation via Zoom OAuth token endpoint (✅ done 2026-05-07, PASS)
Direct probes against `https://zoom.us/oauth/token`:
- Valid creds + bogus code → `invalid_grant: Invalid authorization code` (creds accepted, code rejected)
- Bogus creds (negative control) → `invalid_client: Invalid client_id or client_secret`
- Transitively confirms `redirect_uri` is in Zoom app's registered list (otherwise Zoom would reject earlier with `invalid_redirect_uri`).

#### T3.2.A.4 — Full OAuth click-through (DEFERRED to cutover Step 8)

#### T3.2.B — `zoom-sync-lesson` functional sync (DEFERRED to cutover Step 8)

**Cutover Step 8 must include:**
1. Real Zoom OAuth click-through after frontend cutover (Step 3) is complete
2. Verify a row appears in destination's `calendar_connections WHERE provider = 'zoom'`
3. Pick a test lesson, invoke `zoom-sync-lesson`, verify Zoom meeting created + `zoom_meeting_mappings` row inserted
4. Re-run sync, verify same Zoom meeting ID returned (idempotency)

**Most likely failure modes at cutover (in priority order):**
1. ZOOM_CLIENT_ID/SECRET pairing wrong → `invalid_client` at token exchange
2. Redirect URI mismatch in Zoom app → `invalid_redirect_uri` at authorize endpoint
3. `zoom-oauth-callback` `verify_jwt` config wrong → 401 from gateway before function runs
4. Zoom app suspended → broader auth failures
5. `zoom_meeting_mappings` schema drift (analogous to xero_entity_mappings — see journal "found-while-migrating" entries) → silent INSERT failures, idempotency broken

---

### T3.3 — Google Calendar sync

Sign in → Settings → Integrations → Google Calendar → "Connect" → authorize → create a test lesson → check Google Calendar within 60s.

**Expected:** event in Google Calendar; `calendar_event_mappings` row inserted.

**Failure modes:**
- "Insufficient scope" → calendar scope missing in Google OAuth config

---

## Tier 4 — AI

### T4.1 — LoopAssist chat (Anthropic)

Sign in → LoopAssist → "Show me my upcoming lessons this week".

**Expected:** sensible response within 10s; new rows in `ai_messages`.

**Failure modes:** 401 from Anthropic → API key invalid; quota exceeded → raise limit.

---

### T4.2 — Marketing chat (Gemini)

Marketing site → chat widget → "What's the difference between Studio and Agency plans?".

**Expected:** sensible response within 10s.

**Failure modes:** 401 from Gemini, or `marketing-chat` function logs show wrong model name (should be `gemini-flash-latest`).

---

### T4.3 — CSV import (Gemini-mapped)

Sign in as org owner → Students → Import → upload sample CSV (10 rows, headers like Name/ParentEmail/Day/Time/Instrument).

**Expected:** AI mapping suggestions appear within 10s; dry-run executes cleanly.

**Failure modes:** no suggestions → check `csv-import-mapping` function logs.

---

## Tier 5 — Cron

### T5.1 — Cron job execution

Wait for next scheduled fire (or manually trigger via x-cron-secret as in Phase 5 W5). Check:
```sql
SELECT jobname, status, return_message, start_time::text
  FROM cron.job_run_details
  WHERE start_time > now() - interval '24 hours'
  ORDER BY start_time DESC
  LIMIT 20;
```

**Expected:** `status = 'succeeded'` for all recent runs.

**Failure modes:**
- All 401 → `INTERNAL_CRON_SECRET` not in vault, or function-level mismatch
- Specific 4xx → function-level issue; check function logs

---

## Smoke test execution log template

| Test | Status | Notes |
|---|---|---|
| T1.1 Email/password | ⬜ | |
| T1.2 Google OAuth | ⬜ | |
| T1.3 Password reset | ⬜ | |
| T1.4 Magic link | ⬜ | |
| T2.1 Stripe Checkout | ⬜ | |
| T2.2 Stripe webhook | ⬜ | |
| T2.3 Subscription lifecycle | ⬜ | |
| T3.1 Xero OAuth + sync | ⬜ | |
| T3.2 Zoom OAuth + lesson | ⬜ | |
| T3.3 Google Calendar | ⬜ | |
| T4.1 LoopAssist chat | ⬜ | |
| T4.2 Marketing chat | ⬜ | |
| T4.3 CSV import | ⬜ | |
| T5.1 Cron execution | ⬜ | |

⬜ pending / ✅ pass / ❌ fail / ⚠️ partial
