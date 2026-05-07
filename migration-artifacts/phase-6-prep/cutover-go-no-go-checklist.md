# Cutover Go/No-Go Checklist

Run through each item **immediately before** kicking off the cutover (within the same hour). Each item is binary: tick or do-not-proceed. If any item is ❌, fix it before starting Step 1.

---

## Pre-flight (you, the human)

- [ ] You're at a computer with a real keyboard, not on mobile or tablet.
- [ ] You have **60 uninterrupted minutes** budgeted for Steps 1–6 (iOS Step 7 + validation Step 8 are async).
- [ ] You have your password manager / secret stash ready (you'll need to copy `whsec_…` once during Step 5).
- [ ] You have `cutover-runbook.md` open in a separate window/tab.
- [ ] You have access to: Stripe dashboard, your hosting platform's deploy console, and a terminal pointed at this repo.
- [ ] You're emotionally OK with making mistakes — most are reversible. The only true one-way operation is `git push` (which is fine; we work on the feature branch, not main).

---

## Destination state (verify via terminal — copy-paste each)

Run from a shell with `/tmp/dest_creds.sh` sourced:

- [ ] **No PENDING secrets:**
  ```bash
  source /tmp/dest_creds.sh
  curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$DEST_PROJECT_REF/secrets" | \
    python3 -c "
  import json,sys
  placeholders = {'b03d4a62','62a14978','235a7a50','4cf620fc','1a4c8966','e68d64ce','3f71a160','ea20fa69'}
  pending = [s['name'] for s in json.load(sys.stdin) if s.get('value','')[:8] in placeholders]
  print('PENDING:', pending if pending else 'none — OK')"
  ```
  Expected: `PENDING: none — OK`

- [ ] **All 103 functions ACTIVE:**
  ```bash
  curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$DEST_PROJECT_REF/functions" | \
    python3 -c "
  import json,sys
  fns = json.load(sys.stdin)
  active = sum(1 for f in fns if f.get('status') == 'ACTIVE')
  print(f'{active}/{len(fns)} ACTIVE')"
  ```
  Expected: `103/103 ACTIVE`

- [ ] **18 cron jobs, all active, no source-URL leaks:**
  ```bash
  curl -sS -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
    https://api.supabase.com/v1/projects/$DEST_PROJECT_REF/database/query \
    -d '{"query":"SELECT count(*)::int AS total, count(*) FILTER (WHERE active)::int AS active, count(*) FILTER (WHERE command LIKE '"'"'%ximxgnkpcswbvfrkkmjq%'"'"')::int AS source_leak FROM cron.job;"}'
  ```
  Expected: `[{"total":18,"active":18,"source_leak":0}]`

- [ ] **DB state correct:**
  ```bash
  curl -sS -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
    https://api.supabase.com/v1/projects/$DEST_PROJECT_REF/database/query \
    -d '{"query":"SELECT (SELECT count(*) FROM auth.users)::int AS users, (SELECT count(*) FROM public.profiles)::int AS profiles, (SELECT count(*) FROM supabase_migrations.schema_migrations)::int AS migrations, (SELECT count(*) FROM information_schema.tables WHERE table_schema='"'"'public'"'"' AND table_type='"'"'BASE TABLE'"'"')::int AS tables;"}'
  ```
  Expected: `users=129, profiles=129, migrations=420, tables=93`

- [ ] **Public schema grants intact** (672 per role):
  ```bash
  curl -sS -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
    https://api.supabase.com/v1/projects/$DEST_PROJECT_REF/database/query \
    -d '{"query":"SELECT grantee, count(*)::int FROM information_schema.role_table_grants WHERE table_schema='"'"'public'"'"' AND grantee IN ('"'"'anon'"'"','"'"'authenticated'"'"','"'"'service_role'"'"') GROUP BY grantee;"}'
  ```
  Expected: 672 for each of anon/authenticated/service_role

---

## Configuration (verify in Supabase dashboard or via Mgmt API)

- [ ] **Auth Site URL = `https://app.lessonloop.net`** + redirect whitelist has 5 (or 10) entries
  ```bash
  curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$DEST_PROJECT_REF/config/auth" | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print('site_url:',d['site_url']); print('whitelist:',(d.get('uri_allow_list') or '').split(','))"
  ```

- [ ] **Google OAuth provider enabled** (`external_google_enabled: True` in same response)

- [ ] **SMTP configured** (host, port, user, pass set in same Mgmt API response):
  ```bash
  curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$DEST_PROJECT_REF/config/auth" | \
    python3 -c "
  import json,sys
  d = json.load(sys.stdin)
  for k in ('smtp_host','smtp_port','smtp_user','smtp_admin_email'):
      print(f'{k}:', d.get(k))
  print('smtp_pass:','SET' if d.get('smtp_pass') else 'EMPTY')"
  ```

- [ ] **Email templates copied from source** — visual verify in [destination's auth/templates](https://supabase.com/dashboard/project/xmrhmxizpslhtkibqyfy/auth/templates)

---

## Provider portals (verify via dashboard)

- [ ] **Google Cloud Console** has destination's TWO redirect URIs in the OAuth client's authorized list:
  - `https://xmrhmxizpslhtkibqyfy.supabase.co/auth/v1/callback`
  - `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/calendar-oauth-callback`

- [ ] **Xero developer portal** has destination's redirect URI:
  - `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/xero-oauth-callback`

- [ ] **Zoom Marketplace** has the frontend redirect URI:
  - `https://app.lessonloop.net/auth/zoom/callback`

- [ ] **Resend domain** for `lessonloop.net` shows "Verified"

---

## Code state

- [ ] Working tree clean: `cd /home/user/lessonloop3 && git status` → `nothing to commit`
- [ ] Branch is fully pushed: `git log --oneline origin/$(git rev-parse --abbrev-ref HEAD)..HEAD` → empty
- [ ] All 8 found-while-migrating bug fix commits are in branch:
  ```bash
  git log --oneline | grep -E "025a423|2c4b410|b3b762c|6ad1179|9c72ca3"
  ```
  Expected: 5 lines (8 fixes were committed in 5 commits)

- [ ] Latest commit is the journal/checklist commit (e.g., `b55c6bc Phase 6 Tier 3.3 journal entries...`)

---

## Smoke-test recap (all should be ✅ green from Phase 6)

- [ ] T1.1 Email/password sign-in
- [ ] T1.2 Google OAuth sign-in
- [ ] T1.3 Password reset email delivered to real inbox
- [ ] T2.1 Stripe Checkout (6/6 prices)
- [ ] T2.4 Read-only Stripe functions
- [ ] T3.1 Xero OAuth + invoice sync (verified end-to-end on Xero side)
- [ ] T3.2.A.1-3 Zoom server-side validations (full E2E deferred to cutover Step 8)
- [ ] T3.3.A Google Calendar OAuth
- [ ] T3.3.B Calendar sync with idempotency
- [ ] T3.3.D Busy-block fetch (cron + user paths)
- [ ] Phase 5 cron run history clean (audited at start of Tier 1 testing)

---

## Rollback awareness (must be true to proceed)

- [ ] You understand: **Step 4 (frontend redeploy) is the atomic switch**. Before it, source serves traffic. After it, destination serves traffic.
- [ ] You know how to revert your hosting platform's `VITE_SUPABASE_*` variables and trigger a redeploy.
- [ ] Source project (`ximxgnkpcswbvfrkkmjq`) is intact and reachable as rollback target — D6 says no rush to decommission, so it stays for at least 14 days.
- [ ] You haven't done anything destructive to source yet (no truncates, no schema modifications). Source's data is preserved as Phase 4 baseline.

---

## Final sanity question

> If everything goes perfectly, the cutover takes 60 minutes. If something goes wrong at Step 4, the rollback is "revert hosting env vars + redeploy" (~5 minutes). The worst case is "users see 5 minutes of 5xx" — which we don't have anyway because there are no live users.

- [ ] You're comfortable with the worst-case scenario above.

---

## If all boxes ✅ → kick off Step 1 of cutover-runbook.md

If any box ❌ → halt, fix the failing item, re-run that section's verification, then come back.