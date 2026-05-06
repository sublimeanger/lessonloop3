# Phase 6 Smoke Tests — Execute After Secrets Are In Place

**Purpose:** verify every critical user flow works against destination before cutover. Each test is independent; run in order of criticality so failures stop early.

**Prerequisite:** all 16 placeholder secrets replaced with real values per `secret-fetch-checklist.md`. Run this first:
```bash
supabase secrets list --project-ref xmrhmxizpslhtkibqyfy | grep -E "PENDING_"
```
Expected: empty output. If any `PENDING_*` digests remain, halt and finish secret fetching.

**Test environment:** these tests run against destination's URL (`https://xmrhmxizpslhtkibqyfy.supabase.co`) BEFORE cutting frontend over. You'll need test JWTs generated against destination.

**Exit criteria:** all "blocker" tests pass before proceeding to cutover. "Non-blocker" tests can be deferred to post-cutover if you accept the residual risk.

---

## Test severity classes

- **🔴 BLOCKER** — failure means cutover is unsafe. Must pass.
- **🟠 IMPORTANT** — failure means a feature is broken. Should pass; document if deferred.
- **🟡 NICE-TO-HAVE** — failure indicates an edge case. Can defer.

---

## Tier 1 — Auth (run first; blocks everything else)

### T1.1 — Email/password sign-in 🔴 BLOCKER

**Why:** 119 of 129 destination users authenticate this way.

**Prereq:** Pick a known test user from `auth.users` (NOT a real customer). Generate a fresh password via Admin API (existing source passwords don't migrate):
```bash
source /tmp/dest_creds.sh
# Generate temp password for test user
curl -X PUT \
  -H "Authorization: Bearer $DEST_SERVICE_ROLE_KEY" \
  -H "apikey: $DEST_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$DEST_URL/auth/v1/admin/users/<TEST_USER_ID>" \
  -d '{"password":"TestPass2026!"}'
```

**Steps:**
1. Direct API test:
   ```bash
   curl -X POST -H "apikey: $DEST_ANON_KEY" -H "Content-Type: application/json" \
     "$DEST_URL/auth/v1/token?grant_type=password" \
     -d '{"email":"<test-email>","password":"TestPass2026!"}'
   ```
2. Expected: HTTP 200 with `access_token`, `refresh_token`, `user.id`.

**Expected outcome:** valid session JWT returned.

**Failure modes:**
- 400 `invalid_credentials` → password not set correctly. Re-run admin update.
- 500 → check function logs; likely auth service issue.

---

### T1.2 — Google OAuth sign-in 🔴 BLOCKER

**Why:** 10 destination users authenticate via Google.

**Prereq:** Google OAuth provider enabled on destination (per `phase-6-auth-providers.md`); destination's redirect URI added to Google Cloud Console.

**Steps:**
1. In a browser, visit:
   ```
   https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://app.lessonloop.net/login
   ```
2. Should bounce to `accounts.google.com/o/oauth2/v2/auth?...&client_id=<GOOGLE_CLIENT_ID>`.
3. Sign in with a Google account that exists in destination's `auth.users` (provider='google').
4. Should land back at `https://app.lessonloop.net/login#access_token=...`.

**Expected outcome:** redirect chain works; landing URL has access_token in fragment.

**Failure modes:**
- "redirect_uri_mismatch" → destination's callback URL not in Google Cloud Console authorized list. Add it.
- "invalid_client" → `external_google_client_id` empty in Auth config. Re-paste in dashboard.
- Lands at source's URL instead → site_url not set on destination. Update via Mgmt API.

---

### T1.3 — Password reset email delivery 🔴 BLOCKER

**Why:** if password reset doesn't work, real users locked out post-cutover.

**Prereq:** SMTP configured on destination (per `phase-6-email-config.md`); RESEND_API_KEY set.

**Steps:**
1. Trigger reset for a test user (use your own email):
   ```bash
   curl -X POST -H "apikey: $DEST_ANON_KEY" -H "Content-Type: application/json" \
     "$DEST_URL/auth/v1/recover" \
     -d '{"email":"<your-email>"}'
   ```
2. Expected: HTTP 200, empty body.
3. Wait 60 seconds. Check inbox.

**Expected outcome:** email arrives within 60s, branded as LessonLoop, link points to destination's verify endpoint.

**Failure modes:**
- No email after 5 min → SMTP misconfigured. Check Auth → SMTP settings + try Supabase's "Send test email".
- Email arrives but link is broken → `site_url` wrong. Update.
- Email arrives but unbranded (default `<h2>Reset Password</h2>` boilerplate) → email templates not copied from source. Visual-copy from source dashboard.

---

### T1.4 — Magic link delivery 🟠 IMPORTANT

**Why:** alternative auth path for users who forget passwords.

**Steps:**
1. Trigger magic link:
   ```bash
   curl -X POST -H "apikey: $DEST_ANON_KEY" -H "Content-Type: application/json" \
     "$DEST_URL/auth/v1/magiclink" \
     -d '{"email":"<your-email>"}'
   ```
2. Wait 60 seconds for email.
3. Click link in email — should land at `https://app.lessonloop.net/...#access_token=...`.

**Expected outcome:** authenticated session in browser.

**Failure modes:** same as T1.3.

---

## Tier 2 — Payments (run second; revenue-critical)

### T2.1 — Stripe Checkout flow 🔴 BLOCKER

**Why:** revenue path; broken checkout = no new sales.

**Prereq:** All `STRIPE_*` secrets set on destination. Use Stripe **test mode** for this — switch your Stripe Dashboard to test mode, get test API keys, set those as `STRIPE_SECRET_KEY` temporarily for this test (or use a test-mode duplicate of the function with the test secret in a non-production env).

**Steps:**
1. Sign in as a test user on destination's frontend (after frontend env swap in step 3 of cutover).
2. Navigate to subscription / billing page.
3. Click "Subscribe" → Stripe Checkout opens.
4. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
5. Complete checkout.

**Expected outcome:** redirect back to app with success state; `stripe_checkout_sessions` table has a new row; `subscriptions` table has a new row.

**Failure modes:**
- "No such price" error → `STRIPE_PRICE_*` IDs are wrong or for wrong account. Re-fetch from Stripe dashboard.
- 401 from Stripe API → `STRIPE_SECRET_KEY` invalid.
- Checkout completes but webhook event not processed → Stripe webhook not yet configured (Step 5 of runbook). Test webhook delivery separately.

---

### T2.2 — Stripe webhook delivery 🔴 BLOCKER

**Why:** subscription state, payment events, refunds — all flow through webhooks.

**Prereq:** STRIPE_WEBHOOK_SECRET set on destination (Step 5 of runbook).

**Steps:**
1. In Stripe dashboard → Developers → Webhooks → destination's endpoint
2. Click "Send test webhook"
3. Choose event: `checkout.session.completed`
4. Click "Send test event"
5. Wait 10 seconds.
6. Check destination's `stripe_webhook_events` table:
   ```sql
   SELECT count(*), max(received_at::text) FROM stripe_webhook_events
     WHERE received_at > now() - interval '5 minutes';
   ```

**Expected outcome:** new row in `stripe_webhook_events`. Stripe dashboard shows HTTP 200.

**Failure modes:**
- 4xx in Stripe dashboard → check function logs:
  - `signature verification failed` → STRIPE_WEBHOOK_SECRET mismatch
  - `permission denied` → service-role auth wrong (sb_secret model issue — should be fixed by Phase 5 work)

---

### T2.3 — Subscription lifecycle 🟠 IMPORTANT

**Why:** create / update / cancel subscription state must propagate.

**Steps:**
1. Complete T2.1 (creates a subscription).
2. In Stripe dashboard, find the test customer's subscription, click "Cancel".
3. Wait 30 seconds.
4. Verify destination's `subscriptions` row updates `status` to `canceled` (or whatever LessonLoop's lifecycle column is).

**Expected outcome:** state propagates within 30s of webhook fire.

**Failure modes:** same as T2.2 (webhook delivery issues).

---

## Tier 3 — Integrations (run third; feature-critical but not revenue-blocking)

### T3.1 — Xero OAuth + invoice sync 🟠 IMPORTANT

**Why:** users with Xero linked expect invoices to sync.

**Prereq:** XERO_CLIENT_ID / XERO_CLIENT_SECRET set; redirect URI added to Xero app config.

**Steps:**
1. Sign in to destination's frontend.
2. Navigate to Settings → Integrations → Xero.
3. Click "Connect to Xero".
4. Should redirect to `login.xero.com/identity/connect/authorize?...&client_id=$XERO_CLIENT_ID&redirect_uri=https://app.lessonloop.net/settings/integrations/xero/callback`.
5. Authorize against a test Xero org.
6. Should redirect back to LessonLoop, show "Xero connected" state.
7. Trigger an invoice sync (existing invoice → "Push to Xero").

**Expected outcome:** OAuth completes; `xero_connections` row created; `xero_entity_mappings` row created on first invoice sync.

**Failure modes:**
- redirect_uri_mismatch → callback URL not in Xero app config. Add it.
- 401 from Xero API → CLIENT_ID/CLIENT_SECRET wrong, or scopes don't include `accounting.transactions`.

---

### T3.2 — Zoom OAuth + lesson room create 🟠 IMPORTANT

**Why:** users who use Zoom for lessons expect rooms to auto-create.

**Steps:** analogous to T3.1, with Zoom OAuth flow + creating a test lesson with Zoom enabled.

**Expected outcome:** Zoom meeting created; `zoom_meeting_mappings` row inserted; invitee email sent with Zoom link.

---

### T3.3 — Google Calendar sync 🟠 IMPORTANT

**Why:** users with Google Calendar linked expect lesson events to appear in Calendar.

**Steps:**
1. Sign in.
2. Settings → Integrations → Google Calendar → "Connect".
3. Authorize.
4. Create a test lesson.
5. Open Google Calendar in a separate tab — verify the lesson appears within 60 seconds.

**Expected outcome:** event appears in Google Calendar; `calendar_event_mappings` row inserted.

**Failure modes:**
- "Insufficient scope" → Google OAuth scopes don't include calendar. Update scope list in Google Cloud Console + Supabase Auth provider config.

---

## Tier 4 — AI features (lowest priority; quality-of-life features)

### T4.1 — LoopAssist chat (Anthropic) 🟡 NICE-TO-HAVE

**Prereq:** ANTHROPIC_API_KEY set.

**Steps:**
1. Sign in to destination.
2. Navigate to LoopAssist.
3. Type a prompt: "Show me my upcoming lessons this week"
4. Wait for response.

**Expected outcome:** sensible response within 10s; `ai_messages` table has new rows for user prompt + AI response.

**Failure modes:**
- 401 from Anthropic → API key invalid.
- "Quota exceeded" → key has spending cap; raise it or use a different key.

---

### T4.2 — Marketing chat (Gemini) 🟡 NICE-TO-HAVE

**Prereq:** GEMINI_API_KEY set; this was the function modified in Phase 5 prep (Lovable AI gateway → direct Gemini).

**Steps:**
1. Visit destination's marketing site (https://www.lessonloop.net or wherever marketing chat is hosted).
2. Open chat widget.
3. Send: "What's the difference between the Studio and Agency plans?"

**Expected outcome:** sensible response within 10s.

**Failure modes:** 401 from Gemini → API key wrong; or `marketing-chat` function logs show wrong model name (should be `gemini-flash-latest`).

---

### T4.3 — CSV import (Gemini-mapped) 🟡 NICE-TO-HAVE

**Prereq:** GEMINI_API_KEY set.

**Steps:**
1. Sign in as an org owner.
2. Students → Import → Upload CSV (sample: 10 rows with headers like "Name", "Parent Email", "Day", "Time", "Instrument").
3. AI mapping screen should appear, suggesting column-to-field mappings.
4. Confirm + execute import (use **dry-run mode** for the smoke test if available).

**Expected outcome:** mapping suggestions appear within 10s; if executed, students/guardians inserted correctly.

**Failure modes:**
- No mapping suggestions → `csv-import-mapping` function 4xx. Check logs.
- Wrong mappings → model output formatting issue; review the function's prompt template.

---

## Tier 5 — Cron / scheduled tasks (verify after first scheduled fire)

### T5.1 — Cron job execution 🟠 IMPORTANT

**Why:** automated billing reminders, cleanup, etc., depend on cron firing correctly.

**Steps:** wait for next scheduled boundary (e.g., 03:00 UTC for `cleanup-orphaned-resources`). Check:
```sql
SELECT jobid, jobname, status, return_message, start_time::text, end_time::text
  FROM cron.job_run_details
  WHERE start_time > now() - interval '24 hours'
  ORDER BY start_time DESC
  LIMIT 20;
```

**Expected outcome:** all recent runs show `status = 'succeeded'`. Failures show in `return_message`.

**Failure modes:**
- All 401 → `INTERNAL_CRON_SECRET` not in vault, or function's verification doesn't match the value pg_cron is sending.
- 4xx with specific error → function-level issue; check function logs.

---

## Final go/no-go checklist

After running all the above, you should have:

- [ ] All Tier 1 (Auth) tests pass — **🔴 absolute blocker**
- [ ] All Tier 2 (Payments) tests pass — **🔴 absolute blocker**
- [ ] At least 70% of Tier 3 (Integrations) tests pass — **🟠 acceptable to defer the rest with documented mitigation**
- [ ] Tier 4 (AI) — known-good config, even if smoke tests are skipped
- [ ] Tier 5 (Cron) — at least one successful run since secrets were set, OR manual invocation as in Phase 5 W5

If all the above is green: **proceed to cutover (T6.5 runbook)**. Otherwise: halt, fix, re-test the failed tier.

---

## Smoke test execution log template

Copy this table and fill in as you run:

| Test | Status | Notes / Failure detail | Owner |
|---|---|---|---|
| T1.1 Email/password | ⬜ | | |
| T1.2 Google OAuth | ⬜ | | |
| T1.3 Password reset email | ⬜ | | |
| T1.4 Magic link | ⬜ | | |
| T2.1 Stripe Checkout | ⬜ | | |
| T2.2 Stripe webhook | ⬜ | | |
| T2.3 Subscription lifecycle | ⬜ | | |
| T3.1 Xero OAuth + sync | ⬜ | | |
| T3.2 Zoom OAuth + lesson | ⬜ | | |
| T3.3 Google Calendar | ⬜ | | |
| T4.1 LoopAssist chat | ⬜ | | |
| T4.2 Marketing chat | ⬜ | | |
| T4.3 CSV import | ⬜ | | |
| T5.1 Cron execution | ⬜ | | |

Status legend: ⬜ pending / ✅ pass / ❌ fail / ⚠️ partial-pass-with-caveat
