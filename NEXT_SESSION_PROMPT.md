# Next-session kickoff prompt for LessonLoop pre-launch test build

> Generated 2026-05-09 at end of 4th session (after §24.12 true-replay).
> Paste the block below as the opening message of the next Claude Code
> session. Update this file at the end of the next session so the prompt
> stays current with main.

---

You're picking up an in-flight pre-launch test build for LessonLoop.

Setup:
1. cd /tmp/lessonloop3-deploy && git pull
2. .env.test is already in place (gitignored — last touched 2026-05-09
   to add E2E_STRIPE_TEST_WEBHOOK_SECRET).
3. ~/.claude/settings.json env block already has every token you need:
   SUPABASE_ACCESS_TOKEN (sbp_*, fresh), STRIPE_SECRET_KEY,
   STRIPE_TEST_SECRET_KEY, STRIPE_TEST_WEBHOOK_SECRET (whsec_*, validated),
   NETLIFY_AUTH_TOKEN, CLOUDFLARE_API_TOKEN, SENTRY_AUTH_TOKEN,
   CONTEXT7_API_KEY. **Read this file BEFORE asking the user for any
   token.** Earlier sessions burned cycles asking for things already there.
4. npm install (if node_modules is stale)

Verify baseline:
   ./node_modules/.bin/playwright test --project=master --workers=4

Expected: ~395 passed / 1-5 failed (documented flakes — §5.4 always,
§22.2 + §13 sometimes, 05-rbac Settings degradation in the 13-brittle
JWT-stale group, §17.4 streak progression occasionally on supabaseInsert
infra flake, §20.1 continuation-respond on very occasional curl/spawnSync
ETIMEDOUT — when §20.1 fires it can cascade ~2 dependent serial tests as
"did not run") / ~152 skipped / ~3.5-4.5 min wall-clock. If you see ~35
owner-side failures, the e2e-owner has_completed_onboarding flag has
drifted — fix per HANDOVER.md "Owner has_completed_onboarding drifts to
false (re-fix)" section, then re-run.

Read HANDOVER.md in full before doing anything else. Especially:
- "Token inventory" table at the top of Setup — every token, where
  it lives, what plane (Supabase Management vs PostgREST vs Stripe).
- "What got fixed in production this week" — last two rows are 3rd
  session's bugs (65bde4e continuation-respond verify_jwt + ec94ee3
  streak milestone defensive). Don't re-discover them.
- "Anti-patterns" — particularly: don't use test.fixme() as a
  placeholder, don't trust the catalog's column names blindly,
  don't run trigger guard tests via service-role.

Current commit on main: <PLACEHOLDER_LATEST_SHA> (after the §24.12 true-replay
landing in 499d54b + 4th-session HANDOVER hygiene + this prompt).

Catalog state at this commit:
- §24 Stripe: 12 real (~70%) — §24.12 true-replay landed this session
  (postWebhookEvent helper signs arbitrary events with HMAC-SHA256,
  webhook-layer + RPC-layer dedup both covered)
- §13/§14 Invoices: 22 real (~70-75%)
- §26 Parent portal: 19 real (~70%) — §26.4 + §26.7 + §26.10 +
  §26.12/13 done; §26.5/§26.6/§26.8/§26.11 remaining
- §8 Lesson CRUD: 6 real (~45%) — recurring edit done; student-side
  cancel + make_up_credits trigger remaining
- §17 Practice: 5 real (~60%) — milestone audit-log done
- §20 Continuation: 3 real (~50%)
- Catalog overall: ~38%

What to do:
We're grinding through PLAYWRIGHT_MASTER_CATALOG.md section by section,
replacing test.fixme() with real tests. Per HANDOVER §Next session,
remaining priorities (in effort order):

1. §26.6 — Parent schedule (calendar / upcoming-lessons view).
   Backend-light, mostly UI assertions on /portal/schedule. Reuse
   AUTH.parent storageState + seedLesson factory. Watch for
   ChildFilterContext side-effects when multiple children exist.
   Estimate: 1-2 hours. Launch-in-scope.

2. §26.8 — Parent invoice detail / pay drawer. Stripe-elements-iframe
   heavy; reuse patterns from 24-stripe.spec.ts seedInvoice +
   confirmTestPaymentIntent flow (drive the PI via the Stripe TEST API
   directly, not Elements iframe — too brittle). Estimate: 2-3 hours.

3. §17.5 — cron-based tests (reset_stale_streaks,
   complete_expired_assignments). Needs time-travel — call the cron
   fns directly with seeded backdated rows. Estimate: 2 hours.

4. §8.6/§8.10 — student-side lesson cancel triggers
   auto_issue_credit_on_absence; needs attendance_records insert
   path. Estimate: 1-2 hours.

5. §26.5 messages tab + §26.11 chat non-happy paths. Each ~1-2 hours.

Pick the highest-impact one. Don't use test.fixme() as a placeholder
— write the real test or delete the line.

Workflow per section (also in HANDOVER):
- Read the catalog section in full
- Open the existing master spec file
- For each catalog test case, write a real test (factories in
  tests/e2e/supabase-admin.ts and tests/e2e/master/_fixtures/)
- Run that single file: npx playwright test
  tests/e2e/master/<file>.spec.ts --project=master
- Iterate until green
- Commit: test(e2e): §X — N tests now real
- Update HANDOVER.md ledger + completeness counters
- Push
- Update NEXT_SESSION_PROMPT.md (this file) with the new commit SHA,
  shifted priorities, and any new flakes/gotchas

Production bugs found and fixed in earlier sessions (don't redo, all
already merged + documented in HANDOVER.md "What got fixed in
production this week"):
- 65bde4e (3rd session): continuation-respond had verify_jwt=true but
  frontend uses publishable keys; fully-anon email links were 401'd at
  the gateway. Fixed via supabase/config.toml + redeploy. §26.13
  happy-path test uses fresh `browser.newContext()` (no auth).
- ec94ee3 (3rd session): _notify_streak_milestone errored on missing
  vault secrets, rolled back the user's practice_logs INSERT. Migration
  20260518110000_notify_streak_milestone_defensive.sql wraps the
  net.http_post call in nested EXCEPTION; audit_log row commits as the
  durable record, delivery is best-effort. Note: notifications still
  don't *deliver* because vault is unseeded — separate follow-up.

4th session shipped no production bug fixes — only test coverage
(§24.12 true-replay idempotency) + HANDOVER hygiene.

Open production-relevant items not blocking E2E coverage:
- Vault seeding for SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (so
  streak milestone notifications actually fire). One migration with
  vault.create_secret(). Service-role key value can be read from
  E2E_SUPABASE_SERVICE_ROLE_KEY in .env.test. NEVER commit the
  service-role value; apply via execute_sql or hand-rolled migration
  that's gitignored.
- env-probe-temp edge function at xmrhmxizpslhtkibqyfy can be deleted
  via Supabase Dashboard → Edge Functions (still listed but neutered
  to return 410). Low priority.
- §22/§24 cross-file race fix (playwright.config.ts pool change OR
  give §22 its own throwaway org). HANDOVER "Reality check" has the
  recommended approach. ~30 min.
- The "13 brittle test failures (long-run JWT stale)" gotcha in
  HANDOVER — fix plan is documented (~30 min beforeEach JWT injection).

Begin by reading HANDOVER.md.
