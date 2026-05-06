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

### T2.1 — Stripe Checkout

Use Stripe **test mode** (set `STRIPE_SECRET_KEY` to test-mode key for this test, or use a parallel test deployment).

Sign in to destination's frontend, navigate to subscription/billing, click "Subscribe", use test card `4242 4242 4242 4242`.

**Expected:** redirect back with success state; new row in `stripe_checkout_sessions`; new subscription row.

**Failure modes:**
- "No such price" → wrong/test-mode-only `STRIPE_PRICE_*` IDs
- 401 from Stripe → `STRIPE_SECRET_KEY` invalid
- Webhook event not processed → Step 5 of cutover runbook not done yet

---

### T2.2 — Stripe webhook delivery

Stripe Dashboard → Webhooks → destination's endpoint → "Send test webhook" → `checkout.session.completed`.

**Expected:** HTTP 200; new row in `stripe_webhook_events` within 10s.

**Failure modes:**
- `signature verification failed` → `STRIPE_WEBHOOK_SECRET` mismatch
- `permission denied` → service-role auth wrong (Phase 5 sb_secret fix should resolve this)

---

### T2.3 — Subscription lifecycle

After T2.1, cancel the subscription in Stripe dashboard. Wait 30s. Verify destination's `subscriptions` row updates to `canceled`.

**Failure modes:** same as T2.2.

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

Same pattern as T3.1, with Zoom OAuth + creating a test lesson with Zoom enabled.

**Expected:** Zoom meeting created; `zoom_meeting_mappings` row inserted.

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
