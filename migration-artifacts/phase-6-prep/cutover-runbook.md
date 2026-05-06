# LessonLoop Cutover Runbook — Source → Destination

**Source project:** `ximxgnkpcswbvfrkkmjq` (Lovable Cloud)
**Destination project:** `xmrhmxizpslhtkibqyfy` (your Supabase, EU-West-1)
**Target cutover date:** TBD (set once Phase 6 verifications pass)
**Estimated duration:** 90–120 minutes for steps 1–8; iOS deploy is async (24–48h App Review)

---

## Pre-cutover checklist (must be ✅ before starting)

- [ ] All 16 third-party secrets fetched and set on destination (per `secret-fetch-checklist.md`). Run `supabase secrets list --project-ref xmrhmxizpslhtkibqyfy | grep -E "PENDING_"` — should be empty.
- [ ] Auth providers configured on destination (per `phase-6-auth-providers.md`): Google OAuth enabled, client ID + secret pasted.
- [ ] SMTP configured on destination (per `phase-6-email-config.md`): Resend SMTP host/port/user/pass set.
- [ ] Site URL + redirect whitelist set on destination (per `phase-6-site-url-config.md`).
- [ ] Email templates copied from source to destination (9 templates — recommend visual copy from dashboard).
- [ ] Phase 6 smoke tests passed against destination (per `phase-6-smoke-tests.md`): auth, email delivery, Stripe sandbox, Xero/Zoom/Google OAuth handshakes, AI integrations.
- [ ] DNS for `app.lessonloop.net` — verify the existing CNAME/A record points at your hosting (Vite build target). No DNS change needed unless you're switching hosts.
- [ ] You have your **destination publishable key** ready: `sb_publishable_4VxL8SzppJdtroj4IbmnXg_Ka530Y8f` (NOT the legacy anon JWT — destination uses the new key model).
- [ ] Backup of current production state taken (export of source's auth.users, public schema row counts) for rollback evidence.
- [ ] You've set aside a **2-hour cutover window** with stakeholders informed.
- [ ] Source project is in a known-good state (no in-flight migrations, all jobs green).

---

## Cutover order of operations

### Step 1 — Freeze source (10 min)

**Goal:** prevent new writes to source so it stays as a stable rollback point.

1. Disable cron jobs on source by running this against source's Mgmt API (the source's pg_cron is what's currently triggering most state mutations):
   ```bash
   # Get source's mgmt API token first (from Supabase dashboard → Account → Access Tokens)
   curl -X POST -H "Authorization: Bearer $SOURCE_ACCESS_TOKEN" -H "Content-Type: application/json" \
     "https://api.supabase.com/v1/projects/ximxgnkpcswbvfrkkmjq/database/query" \
     -d '{"query":"UPDATE cron.job SET active = false RETURNING jobname, active;"}'
   ```
2. Post a maintenance banner in the app (or edit a feature flag).
3. Wait 5 min. Check `audit_log` for new writes:
   ```bash
   # Should show 0 new rows in last 5 minutes (or only system/read activity)
   curl -X POST -H "Authorization: Bearer $SOURCE_ACCESS_TOKEN" -H "Content-Type: application/json" \
     "https://api.supabase.com/v1/projects/ximxgnkpcswbvfrkkmjq/database/query" \
     -d '{"query":"SELECT count(*) FROM audit_log WHERE created_at > now() - interval '"'"'5 minutes'"'"';"}'
   ```

**Smoke test:** source's frontend (if accessible) should show maintenance banner; cron should not be firing.

**Rollback:** re-enable crons (`UPDATE cron.job SET active = true`).

---

### Step 2 — Final delta sync (30–60 min)

**Goal:** copy any rows added on source between Phase 3 dump (2026-05-05) and cutover-time. This is the highest-risk step — drift here means lost data.

For each table with high write activity (audit_log, ai_messages, ai_conversations, lessons, payments, invoices, message_log), compute the delta:

```bash
# 1. Source row count (current)
curl -X POST -H "Authorization: Bearer $SOURCE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/ximxgnkpcswbvfrkkmjq/database/query" \
  -d '{"query":"SELECT '"'"'audit_log'"'"' AS t, count(*)::int AS n FROM audit_log UNION ALL SELECT '"'"'lessons'"'"', count(*)::int FROM lessons;"}'

# 2. Destination row count (current)
curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/database/query" \
  -d '{"query":"SELECT '"'"'audit_log'"'"' AS t, count(*)::int AS n FROM audit_log UNION ALL SELECT '"'"'lessons'"'"', count(*)::int FROM lessons;"}'

# 3. Delta = source - destination. If non-zero, dump those rows from source and load them.
```

**Two strategies depending on expected drift size:**

**Option A (small drift, < 1000 rows):** export specific rows by created_at filter, INSERT into destination via Mgmt API in replica mode (same pattern as Phase 3 data load).

**Option B (large drift, > 1000 rows):** invoke source's `migration-dump` function with a since-timestamp filter, re-run the destination data loader for affected tables.

**Smoke test:** post-load row counts on destination match source for every table. No FK orphans.

**Rollback:** delta load is additive — if it fails, no data is lost on either side. Just retry.

---

### Step 3 — Frontend cutover (15 min)

**Goal:** swap the Vite build to point at destination project.

```bash
cd /home/user/lessonloop3

# 1. Backup current .env
cp .env .env.pre-cutover-backup

# 2. Update .env (3 values)
cat > .env << 'EOF'
VITE_SUPABASE_PROJECT_ID="xmrhmxizpslhtkibqyfy"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_4VxL8SzppJdtroj4IbmnXg_Ka530Y8f"
VITE_SUPABASE_URL="https://xmrhmxizpslhtkibqyfy.supabase.co"
EOF

# 3. Verify
grep -E "VITE_SUPABASE" .env
# Should show 3 lines, all xmrhmxiz... values

# 4. Update supabase/config.toml
sed -i.pre-cutover-backup 's|^project_id = "ximxgnkpcswbvfrkkmjq"|project_id = "xmrhmxizpslhtkibqyfy"|' supabase/config.toml
grep "^project_id" supabase/config.toml

# 5. Build
npm install   # only if package-lock.json or node_modules need refresh
npm run build

# 6. Smoke test the build locally
npm run preview
# Open http://localhost:5173 (or whatever port preview reports) — sign in, click around, confirm:
#   - Network tab shows requests to xmrhmxizpslhtkibqyfy.supabase.co (NOT ximxgnk...)
#   - Sign-in works with a known account
#   - Dashboard loads without errors
```

**Smoke test:** open browser DevTools → Network. All Supabase requests should be to `xmrhmxizpslhtkibqyfy.supabase.co`. None to `ximxgnk…`.

**Rollback:** `cp .env.pre-cutover-backup .env && cp supabase/config.toml.pre-cutover-backup supabase/config.toml && npm run build`. Re-deploy.

---

### Step 4 — Deploy frontend to production (15 min)

**Goal:** push the new bundle to production hosting.

This depends on your hosting setup. Common options:

**If you deploy via Lovable's hosting:** push the `.env` change to your Lovable-connected branch; trigger a redeploy.

**If you deploy via Vercel/Netlify/etc.:** update `VITE_SUPABASE_*` variables in the hosting dashboard, redeploy.

**If you deploy via your own infra:** `rsync dist/ user@host:/var/www/lessonloop/`.

After deploy:
- Open `https://app.lessonloop.net` in incognito
- Sign in with a test account
- Confirm DevTools → Network shows requests to destination project ref
- Confirm app behaves normally (dashboard loads, sidebars populate, etc.)

**Smoke test:** complete login flow works. No 401/403 errors. Dashboard data loads.

**Rollback:** revert env vars in hosting + redeploy. Source is still up. Users will see source data again.

---

### Step 5 — Stripe webhook (10 min)

**Goal:** point Stripe webhooks at destination's `stripe-webhook` function and capture the new webhook secret.

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. **Endpoint URL:** `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/stripe-webhook`
4. **Events to send:** select the same set source's webhook subscribes to. (Default LessonLoop set: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`, `payment_intent.*`, `charge.dispute.*`, `payment_method.attached`. Verify against source's existing webhook config.)
5. Click "Add endpoint"
6. Stripe shows the new `whsec_…` once — **copy it immediately**
7. Set on destination:
   ```bash
   supabase secrets set --project-ref xmrhmxizpslhtkibqyfy STRIPE_WEBHOOK_SECRET=whsec_PASTE_HERE
   ```
8. **Disable** source's webhook (don't delete yet — it's a rollback option).
   - Open source's webhook in Stripe dashboard
   - Click "Disable" (Stripe will stop sending events to it but keeps the config)

**Smoke test:** in Stripe dashboard, click "Send test webhook" → choose `checkout.session.completed` → destination's endpoint URL → expect HTTP 200. Verify destination's `stripe_webhook_events` table got a new row.

**Rollback:** re-enable source's webhook in Stripe dashboard; disable destination's.

---

### Step 6 — Xero / Zoom / Google webhook redirects (15 min)

**Goal:** add destination's callback URLs to each OAuth provider so post-OAuth flow lands on destination.

For each provider, **add** destination's callback URL — don't replace source's yet. Both being whitelisted is safe (only the active one is used by the calling app).

**Xero:**
- [Xero Developer → Apps → LessonLoop](https://developer.xero.com/app/manage)
- Add callback: `https://app.lessonloop.net/settings/integrations/xero/callback` (verify path against source's existing one)

**Zoom:**
- [Zoom Marketplace → Develop → Apps → LessonLoop](https://marketplace.zoom.us/develop/apps)
- Add Whitelist URL: `https://app.lessonloop.net/settings/integrations/zoom/callback`

**Google:** already done in T6.1 (Auth provider config) — no extra step here.

**Smoke test:** complete each OAuth flow against destination from a clean account. Connection persists in destination's `xero_connections`/`calendar_connections` table.

**Rollback:** OAuth callbacks are passive — having extra URLs whitelisted is harmless. To rollback, just rebuild the frontend with old `.env`.

---

### Step 7 — iOS app archive + upload (async, 24–48h)

**Goal:** ship the iOS build that points at destination.

```bash
cd /home/user/lessonloop3

# 1. Verify .env is the destination version
grep -E "VITE_SUPABASE" .env  # should show xmrhmxiz...

# 2. Build web bundle
npm run build

# 3. Sync into iOS native project
npx cap sync ios

# 4. Open in Xcode
npx cap open ios
```

In Xcode:
- Select scheme "App" + Configuration "Release"
- Select destination "Any iOS Device (arm64)"
- Product → Archive
- After archive completes: Organizer → "Distribute App" → "App Store Connect" → "Upload"
- Wait for App Store processing (15–30 min)
- Submit for review (24–48h)

**Smoke test:** after TestFlight build is available, install on a test device, sign in, confirm Supabase requests go to destination.

**Rollback:** previous app version remains installed for users who don't update. Source must remain reachable until adoption reaches threshold.

> **Important:** users on the OLD iOS app will continue hitting source's URL until they update. Plan for source to remain reachable in a degraded/read-only state for at least 2 weeks post-App-Store-rollout.

---

### Step 8 — Post-cutover validation (30 min)

**Goal:** confirm everything works end-to-end on destination.

Run through Phase 6 smoke tests one more time, this time against `https://app.lessonloop.net` (the live URL). Pay special attention to:
- Sign-in (email/password + Google) for real existing users (NOT just test accounts) — confirm they can authenticate against destination after migration. **Note:** users will need to reset passwords because Supabase doesn't support migrating password hashes between projects (this is a documented Phase 8 task).
- A real Stripe payment (use a $1 test transaction if you have a sandbox; otherwise verify the next real subscription invoice processes correctly when it fires).
- Cron jobs: confirm next scheduled fire on destination produces expected output (`audit_log` entries, `message_log` entries for emails sent).
- Edge functions: tail logs via `supabase functions logs <function-name> --project-ref xmrhmxizpslhtkibqyfy` for any 5xx errors.

---

## Decision points during cutover

### "Source has writes I forgot about during step 2 — do I keep going?"

**Decision tree:**
- **Drift < 100 rows in non-critical tables:** continue. Re-sync at end.
- **Drift > 100 rows OR drift in critical tables (auth.users, payments, invoices):** halt. Re-run delta sync. Don't proceed until drift is zero.

### "Stripe webhook test came back 4xx, not 200"

- Check `STRIPE_WEBHOOK_SECRET` is set: `supabase secrets list | grep STRIPE_WEBHOOK_SECRET` (should NOT be `PENDING_*`).
- Check function logs: `supabase functions logs stripe-webhook --project-ref xmrhmxizpslhtkibqyfy --tail`
- Common cause: mismatched webhook secret or missing event type in the function's switch/case.
- **Don't proceed past Step 5 until this is 200.** Webhooks failing means revenue events get lost.

### "Auth/Site URL is set wrong, magic links broken"

- Quick fix via Mgmt API (no dashboard re-login needed):
  ```bash
  curl -X PATCH -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
    "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" \
    -d '{"site_url": "https://app.lessonloop.net"}'
  ```

---

## Rollback plan (if cutover needs to be aborted)

**At any step before Step 4:** trivial — destination is just sitting there receiving no traffic. Revert local file changes (`.env`, `config.toml`), don't deploy. Source continues serving.

**After Step 4 (frontend deployed pointing at destination):**
1. Revert env vars in hosting (`VITE_SUPABASE_*` back to source values)
2. Redeploy frontend
3. Verify users hit source again
4. Source's data is intact (we never deleted anything)
5. Disable destination's cron (`UPDATE cron.job SET active = false`) to prevent destination from continuing to run scheduled tasks
6. Keep destination project alive for diagnosis; do not delete

**After Step 5 (Stripe webhook switched):**
1. Re-enable source's webhook in Stripe dashboard
2. Disable destination's webhook
3. Note: any Stripe events received by destination during the cutover window need to be either (a) acknowledged on destination's data, OR (b) replayed against source after rollback. Stripe will retry failed webhooks for 3 days, so catching anything dropped is feasible.

**After Step 7 (iOS build submitted):**
- Can't fully roll back iOS — submitted versions are submitted. But if you reject the version in App Store Connect before it's released, you can submit a new build that points back at source.

---

## Post-cutover cleanup (Phase 8 — separate workstream)

- [ ] Send password reset emails to all 119 email/password users (they'll need to set new passwords on destination).
- [ ] Drop `migration-dump` bucket on both projects.
- [ ] Drop unused tables/columns flagged in Phase 5 deferred work.
- [ ] After 2 weeks of stable destination operation: deprovision source (snapshot first, then delete project).
- [ ] Update DNS records, monitoring/alerting endpoints, Sentry/Datadog tags to reflect destination project ref.
- [ ] Internal docs / wiki / runbooks updated.

---

## Key URLs (quick reference)

| Service | URL |
|---|---|
| Source dashboard | https://supabase.com/dashboard/project/ximxgnkpcswbvfrkkmjq |
| Destination dashboard | https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy |
| Destination Auth providers | https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/providers |
| Destination URL config | https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/url-configuration |
| Destination function logs | https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/functions |
| Destination secrets | https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/settings/secrets |
| Stripe webhooks | https://dashboard.stripe.com/webhooks |
| Resend domains | https://resend.com/domains |
| Resend API keys | https://resend.com/api-keys |
| Google OAuth | https://console.cloud.google.com/apis/credentials |
| Xero apps | https://developer.xero.com/app/manage |
| Zoom apps | https://marketplace.zoom.us/develop/apps |
| Production site | https://app.lessonloop.net |

---

## Key values (keep handy during cutover)

```
SOURCE_PROJECT_REF      = ximxgnkpcswbvfrkkmjq
DEST_PROJECT_REF        = xmrhmxizpslhtkibqyfy

DEST_PUBLISHABLE_KEY    = sb_publishable_4VxL8SzppJdtroj4IbmnXg_Ka530Y8f
DEST_URL                = https://xmrhmxizpslhtkibqyfy.supabase.co
DEST_AUTH_CALLBACK      = https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/callback
DEST_STRIPE_WEBHOOK_URL = https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/stripe-webhook

SITE_URL                = https://app.lessonloop.net
SOURCE_DECOMMISSION_DATE = (set to cutover + 14 days)
```
