# LessonLoop Cutover Runbook — Source → Destination

**Source project:** `ximxgnkpcswbvfrkkmjq` (Lovable Cloud)
**Destination project:** `xmrhmxizpslhtkibqyfy` (your Supabase, EU-West-1)
**No live users** — operate with confidence. Source stays around (D6: no rush to decommission).

---

## Pre-cutover checklist

- [ ] All 16 third-party secrets fetched and set on destination per `secret-fetch-checklist.md`. Verify: `supabase secrets list --project-ref xmrhmxizpslhtkibqyfy | grep -E "PENDING_"` is empty.
- [ ] Auth providers configured per `phase-6-auth-providers.md`: Google enabled with source's client ID/secret, destination callback URL added to Google Cloud Console.
- [ ] SMTP configured per `phase-6-email-config.md`: Resend host/port/user/pass set; 9 templates copied from source.
- [ ] Site URL + 10-entry redirect whitelist set per `phase-6-site-url-config.md`.
- [ ] Phase 6 smoke tests pass per `phase-6-smoke-tests.md`.
- [ ] Destination publishable key on hand: `sb_publishable_4VxL8SzppJdtroj4IbmnXg_Ka530Y8f`

---

## Order of operations

### Step 1 — Freeze source (10 min)

Disable cron on source so it stops mutating during the delta sync window.

```bash
# Source mgmt API token (from Supabase dashboard → Account → Access Tokens)
curl -X POST -H "Authorization: Bearer $SOURCE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/ximxgnkpcswbvfrkkmjq/database/query" \
  -d '{"query":"UPDATE cron.job SET active = false RETURNING jobname, active;"}'
```

Verify by checking `audit_log` for new writes after 5 min:
```bash
curl -X POST -H "Authorization: Bearer $SOURCE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/ximxgnkpcswbvfrkkmjq/database/query" \
  -d '{"query":"SELECT count(*) FROM audit_log WHERE created_at > now() - interval '"'"'5 minutes'"'"';"}'
```

**Rollback:** `UPDATE cron.job SET active = true`.

---

### Step 2 — Delta sync (variable, depends on drift)

Compute drift since the Phase 3 dump (2026-05-05) and copy missing rows.

For each high-write table (audit_log, ai_messages, ai_conversations, lessons, payments, invoices, message_log):
```bash
# Source count
curl -X POST -H "Authorization: Bearer $SOURCE_ACCESS_TOKEN" ... \
  -d '{"query":"SELECT count(*)::int FROM <table>;"}'

# Destination count
curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" ... \
  -d '{"query":"SELECT count(*)::int FROM <table>;"}'

# Diff = source - destination
```

If non-zero: dump those rows from source by `created_at > '2026-05-05T<hour>:00:00Z'`, INSERT into destination via Mgmt API in replica mode (same pattern as Phase 3 loader).

**Rollback:** delta load is additive; failed inserts don't damage either side.

---

### Step 3 — Frontend cutover (15 min)

```bash
cd /home/user/lessonloop3

# Backup
cp .env .env.pre-cutover-backup
cp supabase/config.toml supabase/config.toml.pre-cutover-backup

# Swap .env
# Note: VITE_STRIPE_PUBLISHABLE_KEY was missing from source's .env (Stripe Elements would
# warn at runtime). Adding it here so the frontend can load Stripe Elements correctly.
cat > .env << 'EOF'
VITE_SUPABASE_PROJECT_ID="xmrhmxizpslhtkibqyfy"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_4VxL8SzppJdtroj4IbmnXg_Ka530Y8f"
VITE_SUPABASE_URL="https://xmrhmxizpslhtkibqyfy.supabase.co"
VITE_STRIPE_PUBLISHABLE_KEY="pk_live_51SrzbkAzPfYm94uxnOmeYsSDBu2NCGUxPjvTShMXjCGHQQnmS8Eo9rkZj5RgEiTZm8Zjg7qs75GDrABUJ2Sge4rK00qwTULz0G"
EOF

# Swap config.toml
sed -i 's|^project_id = "ximxgnkpcswbvfrkkmjq"|project_id = "xmrhmxizpslhtkibqyfy"|' supabase/config.toml

# Verify
grep -E "VITE_" .env
grep "^project_id" supabase/config.toml

# Build + smoke
npm install   # only if needed
npm run build
npm run preview
```

Open the preview URL in browser, sign in with a test account, confirm DevTools Network panel shows requests to `xmrhmxizpslhtkibqyfy.supabase.co` (not source).

**Rollback:** `cp .env.pre-cutover-backup .env && cp supabase/config.toml.pre-cutover-backup supabase/config.toml && npm run build`.

---

### Step 4 — Deploy frontend to production (15 min)

Update `VITE_SUPABASE_*` env vars in your hosting platform → redeploy.

After deploy: open `https://app.lessonloop.net` incognito, sign in, confirm Network requests go to destination.

**Rollback:** revert hosting env vars + redeploy. Source is still intact.

---

### Step 5 — Stripe webhook (10 min)

1. [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) → "Add endpoint"
2. URL: `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/stripe-webhook`
3. Events: same set source's webhook subscribes to
4. Stripe shows the new `whsec_…` once — copy immediately
5. Set:
   ```bash
   supabase secrets set --project-ref xmrhmxizpslhtkibqyfy STRIPE_WEBHOOK_SECRET=whsec_PASTE_HERE
   ```
6. Disable source's webhook (don't delete — rollback option).

**Test:** Stripe dashboard → "Send test webhook" → `checkout.session.completed` → expect HTTP 200; `stripe_webhook_events` table got a new row.

**Rollback:** re-enable source's webhook; disable destination's.

---

### Step 6 — Add destination callbacks to OAuth providers (15 min)

Add destination's callback to each (don't replace source's — both can coexist):

- **Xero:** [developer.xero.com/app/manage](https://developer.xero.com/app/manage) → add redirect URI `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/xero-oauth-callback`
- **Zoom:** [marketplace.zoom.us/develop/apps](https://marketplace.zoom.us/develop/apps) → add Whitelist URL `https://app.lessonloop.net/auth/zoom/callback` (Zoom is the only one that uses a frontend route — it forwards the code to the edge function)
- **Google:** add TWO redirect URIs to existing OAuth client at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials):
  - `https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/callback` — sign-in (also done in Step 1)
  - `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/calendar-oauth-callback` — Calendar OAuth

**Test:** complete each OAuth flow against destination from a clean account → row in `xero_connections` / `calendar_connections`.

**Rollback:** harmless — extra callback URLs don't affect anything.

---

### Step 7 — iOS app archive + upload (async)

```bash
cd /home/user/lessonloop3

# Verify .env points at destination
grep -E "VITE_SUPABASE" .env

# Build + sync + open
npm run build
npx cap sync ios
npx cap open ios
```

Xcode: "App" scheme / Release / "Any iOS Device (arm64)" → Product → Archive → Distribute App → App Store Connect → Upload.

Wait for App Store processing + review. D6: no rush.

---

### Step 8 — Validation (30 min)

Re-run smoke tests against the live URL `https://app.lessonloop.net`:
- Sign-in (email/password + Google)
- Stripe checkout
- Function logs: `supabase functions logs <name> --project-ref xmrhmxizpslhtkibqyfy --tail` for any 5xx
- Cron: confirm next scheduled fire produces expected output (`audit_log`, `message_log` entries)

**Phase 6 deferred Tier 3 items — must be exercised here for the first time:**
- **Zoom OAuth + sync** (was untestable pre-cutover because flow is frontend-mediated and the production frontend was bound to source's Supabase URL):
  - Sign in → Settings → Integrations → Zoom → "Connect"
  - Authorize against a real or test Zoom account
  - Verify: row appears in `calendar_connections WHERE provider = 'zoom'`
  - Pick a test lesson, click "Sync to Zoom" (or trigger via `zoom-sync-lesson` function call)
  - Verify: Zoom meeting created in Zoom dashboard, row in `zoom_meeting_mappings`
  - Re-run sync, verify same Zoom meeting ID (idempotency)
  - **If failure:** check causes in priority order — (1) ZOOM_CLIENT_ID/SECRET pairing, (2) redirect URI in Zoom Marketplace, (3) zoom-oauth-callback `verify_jwt` config, (4) `zoom_meeting_mappings` schema drift (analogous to the xero_entity_mappings bug we fixed in Phase 6 — INSERT may silently fail on NOT NULL columns; check function logs for `console.error` from any insert)

---

## Decision points during cutover

### "Source has writes I forgot about during Step 2"

Continue. Re-run delta sync at end of Step 2 until destination = source for the tables you care about.

### "Stripe webhook test came back 4xx"

- Check `STRIPE_WEBHOOK_SECRET` is set: `supabase secrets list | grep STRIPE_WEBHOOK_SECRET` (should NOT show `PENDING_*`).
- Tail function logs: `supabase functions logs stripe-webhook --project-ref xmrhmxizpslhtkibqyfy --tail`
- Common cause: signature mismatch. Re-fetch `whsec_…` from Stripe dashboard, re-set, retry.

### "Magic links broken / Site URL wrong"

```bash
curl -X PATCH -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/xmrhmxizpslhtkibqyfy/config/auth" \
  -d '{"site_url": "https://app.lessonloop.net"}'
```

---

## Post-cutover cleanup (Phase 8)

- [ ] Apple Sign-In code cleanup (3 files per `phase-6-ios-cutover-prep.md` D2 list).
- [ ] Drop `migration-dump` bucket on both projects.
- [ ] Address Phase 5 deferred items in journal (xero_connections RLS, storage.objects.owner, etc.).
- [ ] Source decommission: D6 — whenever, no rush. Snapshot first.
- [ ] Update internal docs / monitoring / alerts to reference destination ref.

---

## Key URLs

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
| Google OAuth | https://console.cloud.google.com/apis/credentials |
| Xero apps | https://developer.xero.com/app/manage |
| Zoom apps | https://marketplace.zoom.us/develop/apps |
| Production site | https://app.lessonloop.net |

---

## Key values

```
SOURCE_PROJECT_REF      = ximxgnkpcswbvfrkkmjq
DEST_PROJECT_REF        = xmrhmxizpslhtkibqyfy

DEST_PUBLISHABLE_KEY    = sb_publishable_4VxL8SzppJdtroj4IbmnXg_Ka530Y8f
DEST_URL                = https://xmrhmxizpslhtkibqyfy.supabase.co
DEST_AUTH_CALLBACK      = https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/callback
DEST_STRIPE_WEBHOOK_URL = https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/stripe-webhook

SITE_URL                = https://app.lessonloop.net
```
