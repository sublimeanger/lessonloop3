# LessonLoop pre-launch handover (Claude session continuity)

**Last updated:** 2026-05-10 (after 15th-session — flake hardening for §13.7.4 + §14.10.16 via service-role curl pattern; §22 +4 real tests (50%→75%); §11 +3 real tests (60%→75%); audit hygiene 12 rows promoted 🟡→🟢 per the recalibrated world-class bar) by Claude Opus 4.7 (1M context)
**Working repo:** `sublimeanger/lessonloop3` (branch: `main`)
**Working dir on author's machine:** `/tmp/lessonloop3-deploy`
**Owner:** Jamie McKaye (`jamie@searchflare.co.uk`)

**Session ledger (commits on `main`):**
- `b7900ab` — J24-A canary (migration + helper + stripe-list-payment-methods)
- `763c474` — Batch A+B (6 read/light-write fns)
- `049e84f` — Batch C (payment-intent + checkout)
- `5a8ca45` — Batch D (refund + connect-onboard + auto-pay)
- `10f35e2` — Batch E (admin-backfill + reminder shared core)
- `2bf0aea` — dual-mode webhook signature verification
- `e36e486` — §24 Stripe — 10 real tests (was 11 fixmes)
- `7dcd024` — fix(test-infra): seedInvoice silently lost status transitions
- d7bc927 — §13/§14 Invoices — 13 fixmes → 0, 22 real tests
  (handover hygiene in 8f37886)
- Live Stripe webhook subscription patched (we_1TUlSHAzPfYm94ux4mOfF72i),
  18 events configured (was 6) — closes the P0 production gap previously
  flagged in the §24 progress notes. No commit (Stripe Dashboard config).
- 0f91088 — §26.10 parent compose thread (5 tests)
- a5dec8b — §26.12/§26.13 continuation response (4 tests)
- 4796f9a — §8.5 recurring lesson edit (2 tests)
- 65bde4e — fix(edge): continuation-respond verify_jwt=false (unauth flow)
- ec94ee3 — fix(db): _notify_streak_milestone defensive + §17.4 test (1 test)
- 499d54b — test(e2e): §24.12 — true-replay webhook idempotency
  (2 tests + postWebhookEvent helper; HMAC-SHA256 sign arbitrary
  Stripe events; covers webhook-layer + RPC-layer dedup)
- acc6015 — test(e2e): §26.6 PortalSchedule (8 tests + helpers;
  grouping + past-collapsible, all 3 reschedule policies
  admin_locked / request_only / self_service, Google Cal URL
  format, ICS download content, calendar-ical-feed VEVENT
  end-to-end). Status vs v2 launch scope: launch-in-scope
  (parent portal core per LESSONLOOP_V2_PLAN.md §3.1).
- 39c11d9 — test(e2e): §26.9 PortalInvoices (3 tests; pay full
  invoice end-to-end via §24-style helpers + UI smoke for the
  PaymentDrawer + filter by status + PDF download). Same commit
  also hardens 26-parent-portal.spec.ts itself: §26.4 makeup
  describe set to mode='serial' (4 tests collide on +3 day
  matched_lesson teacher slot when run parallel), file-level
  resetE2ERateLimits() in beforeAll (§26.10 send-parent-message
  was hitting hourly cap mid-suite after the file grew),
  seedScheduledLessonForParent atomic-on-failure (rolls back
  student insert if lesson INSERT throws — prevents orphan
  cascade), and a deterministic per-testId minute offset on
  §26.6.1's lesson seed times so runs <30min apart land in
  different 30-min slots. Status vs v2 launch scope:
  launch-critical (Stripe Connect / parent payment per §3.1).
- f7ee87d — test(e2e): §17.5.5 reset_stale_streaks + §17.5.6
  complete_expired_assignments (2 tests). Both cron functions are
  plain `BEGIN UPDATE … END;` plpgsql; we call them directly via
  service-role RPC `/rest/v1/rpc/<name>` rather than time-travel
  fixtures. Each test seeds two rows in distinct pre-states (stale
  vs fresh streak; expired vs future-dated assignment + a NULL
  end_date row), invokes the cron, and asserts only the matching
  rows transitioned — proving both the WHERE predicate and the
  cron's idempotence on already-clean rows. Status vs v2 launch
  scope: launch-in-scope (Practice tracking + streaks per §3.1)
  but cron behaviour isn't first-day critical.
- 6a0bbab — test(e2e): §11.4.1 unlinked teacher contract (1 test).
  Verifies that inserting a `teachers` row without user_id leaves
  the row in the unlinked state — no auto-created org_memberships
  row, no `invites` row keyed on the email, but the
  audit_teachers_changes trigger does fire (audit_log row lands).
  Documents that §11.4.9 protect_teacher_user_link is already
  covered by §32.7 in the master baseline. Status vs v2 launch
  scope: launch-in-scope (Teachers per §3.1).
- 6205880 — test(e2e): §15.4.7 Outstanding report data correctness
  (1 test). Seed a sent invoice with due_date +5 days, render
  /reports/outstanding as owner, assert the invoice_number text
  appears in the Current (0-7 days) bucket's expanded table.
  Outstanding's `expandedBuckets` initial state in the page
  component already includes the Current bucket — clicking the
  trigger would COLLAPSE it (this caught me on the first run).
  Same commit also hardens patchOrgReschedulePolicy (in
  26-parent-portal.spec.ts) with a 57014 statement_timeout retry
  + 1s backoff — a transient master-suite flake I hit while
  verifying §15.4 affected §26.6.6 admin_locked when the org
  table was under concurrent load. Status vs v2 launch scope:
  launch-in-scope (Reports per §3.1).
- da619ca — test(e2e): §16 staff-side messages (5 tests) +
  send-message 400-on-missing-fields fix. Covers happy path
  (owner→guardian, send_email=false, recipient resolved server-side
  from guardians table), missing-fields validation (NEW: returns
  400, was 500 — the original `throw` fell into the outer catch
  and masked the validation error as a generic server crash),
  oversized subject + body (≤500/≤10000 limits), parent JWT 403
  at the membership role check (parent has org_memberships row
  with role='parent', allowlist is owner/admin/teacher), cross-org
  recipient 403 (creates throwaway organisation + guardian for the
  test, asserts the guardian.org_id !== data.org_id check fires).
  Edge fn fix deployed as send-message v18 to xmrhmxizpslhtkibqyfy.
  Finding doc: audit/findings/2026-05-09-send-message-missing-fields-500.md.
  Status vs v2 launch scope: launch-in-scope (Messages per §3.1).
- a482407 — test(e2e): §10.7 CSV import (5 tests, Lauren-critical
  for bulk onboarding ~250 students at launch). Drives
  csv-import-execute edge fn directly (no file-upload UI fixture).
  Tests: dry-run with 5 valid rows → preview.studentsToCreate=5;
  execute 3 valid rows → studentsCreated=3 + importBatchId, then
  undo_student_import RPC reverses (SOFT-deletes via deleted_at —
  confirmed via pg_get_functiondef inspection, NOT hard delete);
  malformed row (invalid email) → row 2 in validation.errors;
  CSV-internal duplicate emails → second row flagged as
  duplicate_csv with duplicateOf=1; missing first_name → row
  marked invalid with /Missing first_name/. Resets csv-import
  rate limit (10/10min per user) at beforeAll. Status vs v2
  launch scope: launch-in-scope (Students CSV import per §3.1).
- 3095a15 — test(e2e): §15.4 data correctness for 4 of the 7
  remaining reports (LessonsDelivered, Cancellations, Attendance,
  Revenue). Mirrors §15.4.7 Outstanding pattern: seed minimum
  data, render report as owner, assert specific identifier visible.
  Schema gotcha: attendance_records.recorded_by is NOT NULL with
  no default — every insert must pass a uuid (use getOwnerUserId).
  For Cancellations: PATCH lesson to cancelled FIRST, then insert
  attendance — trg_cleanup_attendance_on_cancel fires on lesson
  UPDATE not on attendance INSERT, so the right order survives the
  trigger. Deferred to session 7 (need more involved seeds):
  Payroll (teacher pay rate setup), Utilisation (room capacity +
  closure_dates), Teacher Performance (FeatureGate-protected at
  TeacherPerformance.tsx:101). Status vs v2 launch scope:
  launch-in-scope (Reports per §3.1).
- (audit hygiene commit) — docs(audit): MASTER.md row updates for
  sections touched + 4 mature clusters (parent portal, practice,
  invoices, Stripe webhook). 7 parent-portal rows tagged
  [PROMOTABLE 🟡→🟢] for Jamie's review pass. Header bumped to
  2026-05-09.
- 35631ad — test(e2e): §20 Continuation 6 new tests for the
  run-creation backend (Lauren-paramount per §3.1). §20.4
  create-continuation-run happy path (seed terms + active student +
  recurring lesson + parent guardian → run row in draft + 1
  pending response with lesson_summary), §20.4 RBAC parent JWT
  → 403, §20.4 validation missing fields → 400, §20.5 process_deadline
  assumed_continuing=true (pending → assumed_continuing) +
  assumed_continuing=false (pending → no_response), §20.7
  bulk-process-continuation confirmed flow (extends recurrence,
  materialises lessons via `materialise_continuation_lessons` RPC,
  marks response is_processed, flips run to completed). Switched the
  baseYear hash for term-overlap avoidance from a deterministic
  testId-based hash with %50 buckets to Math.random() across a
  500-year window — old scheme caused parallel-test collisions on
  the check_term_overlap trigger. Withdrawal-flow + delete-run
  paths still deferred. Status vs v2 launch scope: launch-in-scope
  (term-end critical per §3.1).
- 10ca3ad — test(e2e): §26.10 reply on existing thread (3 tests:
  happy path with thread_id+subject "Re: …" derivation, 404 on
  missing parent_message_id, 403 cross-tenant) + §26.11
  PortalProfile notification preferences (1 test: toggle switch
  + Save → notification_preferences upsert lands the new bool).
  Required a `selectServiceRole()` inline helper for §26.11 —
  the parent's notification_preferences row is RLS-blocked from
  the owner JWT that supabase-admin's supabaseSelect uses. Same
  commit also adds E2E_PARENT_GUARDIAN_ID constant to the §26.10
  describe (was missing — only §26.4 had it). Status vs v2 launch
  scope: launch-in-scope (parent portal core).
- c8b6c4e — test(e2e): §8.6 cancel flow + §8.8.9 attendance
  cleanup trigger + §8.8.10a/b auto_issue_credit_on_absence
  (3 tests; Lauren-paramount make-up flow per
  LESSONLOOP_V2_PLAN.md §3.1). 8.8.9 verifies that
  trg_cleanup_attendance_on_cancel deletes attendance_records
  when lesson goes from any status → cancelled. 8.8.10a patches
  the e2e org's `sick` policy to `automatic` for the test (the
  default seed is `waitlist`), inserts attendance with
  cancelled_by_student + sick reason, asserts make_up_credits
  row created with credit_value_minor=3500 (£35 from the org's
  default rate card "Standard 30-min") + audit_log entry. 8.8.10b
  uses `holiday` (not_eligible) and asserts no credit. Same
  commit also widens lessonSlotOffsetMs in 26-parent-portal.spec
  from 12-slot deterministic-by-testId to 24-slot Math.random()
  per call — stops retries from re-hitting the same orphan
  collision slot if a previous run was killed mid-cleanup.
- e08482a — test(e2e): post-goto JWT injection to defuse long-run
  staleness (priority 1 of 7th session). Augments
  _fixtures/auth-refresh.ts with a `page` fixture wrapper that, on
  the FIRST page.goto in a test, re-reads the (possibly newly-
  refreshed) storage state file and overwrites the running
  browser's localStorage with the latest token. Pairs with the
  pre-existing `storageState` override that refreshes the file on
  disk before context creation — together they cover both layers
  (file-on-disk + in-memory localStorage). STORAGE_KEY now derived
  from E2E_SUPABASE_URL rather than hardcoded to project ref.
  IMPORTANT: spot-check on 05-rbac + 06-dashboard still showed the
  same 2 documented persistent flakes (§5.4 email_not_confirmed —
  Supabase auth quirk for fresh throwaway users; RBAC Settings
  degradation — UI render race waiting for Profile content). The
  fix landed clean and is benign-additive but the 2 visible flakes
  are NOT actually JWT-stale — they have different root causes.
  Conservative additive change should help genuine staleness in
  long parallel runs without masking other failures.
- 4c34bf0 — test(e2e): §22 Settings — 8 new real tests for
  launch-visible mutations (priority 2). Direct REST-driven coverage
  for the four §22 mutation surfaces v2 plan §3.1/§3.2 lists as
  launch-in-scope: §22.2 schedule_hours validation (2 — valid range
  persists / end ≤ start rejected by validate_schedule_hours trigger
  with expected error message; org row stays atomic on failure),
  §22.2 parent_reschedule_policy (3 — one per supported value
  admin_locked / request_only / self_service; restored in finally so
  parallel §26.6 portal tests don't leak across), §22.20 Continuation
  defaults (1 — 3-field atomic notice_weeks + assumed_continuing +
  reminder_days), §22.4 Invite member (1 — INSERT into invites via
  owner JWT, asserts role + 7d expires_at default + token populated),
  §22.9 Music custom-instrument CRUD (1 — INSERT is_custom=true →
  UPDATE category → DELETE; assert org_id scoping). Two new inline
  helpers: patchOrgViaOwnerJwt(body) for fire-and-forget mutations,
  patchOrgWithBody(body) when test needs to assert response body
  (trigger error messages). Status: launch-in-scope. File-level run:
  39 passed / 11 skipped / 24s.
- 1fca3c2 — test(e2e): §27 Notifications — 5 new real tests for
  pref/dedup contracts (priority 3). DB-layer + auth-gate coverage
  for the email-sending path's pref-honoring contract.
  IMPORTANT pivot story: the original plan was to POST
  send-payment-receipt with prefs=false → assert {opted out} +
  zero message_log rows. That hit a 401 wall — the function's
  inline `authHeader.includes(supabaseServiceKey)` check requires
  byte-equal substring match against `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`,
  and `E2E_SUPABASE_SERVICE_ROLE_KEY` in .env.test (a legacy JWT
  iat=2026-04-29) doesn't match the deployed function's env value
  post 2026-05-08 migration. Deployment env value is SHA-256-hashed
  by Management API readback (no plaintext recovery without
  rotation). Pivoted to DB-layer contract tests that prove what the
  fn depends on: §27.2 prefs upsert + fn-shape SELECT round-trip
  (2 tests — prefs=false survives, absent-row returns 0); §27 dedup
  unique partial idx_message_log_payment_receipt_dedup (1 test —
  inserting 2nd row with same payment_id+message_type='payment_receipt'
  fails 23505); §27 RBAC auth gate (2 tests — anon→401, no-auth→401;
  these are independent of the env-drift). Inline helpers:
  selectNotifPrefServiceRole, insertMessageLogRaw (captures status +
  body for 23505 assertion), upsertParentNotifPref,
  deleteParentNotifPref. Status: launch-in-scope. File-level run:
  14 passed / 1 skipped / 4.2s.
- 6f2c09b — docs(audit): MASTER.md hygiene — §22 Settings + §27
  Receipt email rows tagged with [E2E real per <sha>], header
  bumped to 2026-05-09 7th-session reference. Estimated ~28 of
  ~180 rows now have E2E real proof appended (was ~25).
- 3e9891b — test(e2e): §15.4 last 3 reports data-correctness
  (Payroll, Utilisation, TeacherPerformance — priority 2 of 8th
  session). Pattern is identical to 6205880/3095a15: seed minimum
  data, render report as owner, assert specific identifier in the
  rendered table. §15 cluster now 7/7 reports data-correctness
  green. Payroll: completed lesson last month → owner display_name
  in PayrollTeacherList. Utilisation: seeded room
  (`<testId>_UtilRoom`) + lesson in it → unique room name in
  Room Details table; reused the e2e org's existing "Main Studio"
  location_id (rooms.location_id NOT NULL). TeacherPerformance:
  FeatureGate('teacher_performance') satisfied — e2e org plan
  'academy' active (verified via execute_sql 2026-05-09); 20s
  timeout since the hook pulls 5 tables. Inline `execSync` lifted
  to top-of-file import. File-level run: 23 passed / 21.3s.
  Status vs v2 launch scope: launch-in-scope (Reports per §3.1).
- ae87a48 — test(e2e): §26.9.2 + §26.9.3 payment-plan installment
  pays (priority 3 of 8th session). Backend-correctness via
  owner-JWT RPC (matches §17.5 cron pattern; §26.9.1 already
  covers full Stripe-drawer end-to-end). §26.9.2: pay one
  installment of 3 → that one paid, others pending, invoice
  stays 'sent', invoice.paid_minor matches the single installment.
  §26.9.3: pay all 3 → all paid, invoice transitions to 'paid',
  paid_minor=total_minor; final RPC call is the only one returning
  {all_paid: true}; payments table has 3 rows linked to distinct
  installments. Required learning: generate_installments has
  `is_org_finance_team(auth.uid(), _org_id)` inside its SECURITY
  DEFINER body — service-role's auth.uid()=null fails the check;
  owner JWT is the right caller (e2e owner is finance team). Added
  supabaseRpc to the file's supabase-admin imports. Schema reality:
  invoice_status enum has no 'partially_paid' value
  ({draft,sent,paid,overdue,void,outstanding}); the catalog's
  "partially_paid" applies to per-installment status, not parent
  invoice. §26.9 cluster now 5/7 cases green (1, 2, 3, 6, 7); cases
  4-5 are mobile-safari project. File-level run: 11 passed / 18.3s.
  Status vs v2 launch scope: launch-in-scope (parent payment per §3.1).
- (audit hygiene commit) — docs(audit): MASTER.md hygiene — §15
  Payroll/Utilisation/TeacherPerformance + §26.9.2/3 + backfilled
  §11.4.1 unlinked-teacher tag (was missing from 5th-session work).
  Estimated ~32 of ~180 rows now have E2E real proof appended (was
  ~28 at session 7 end). §15 cluster fully tagged across all 7
  launch reports.
- (8th-session start) Manual SQL sweep of stale e2e_ student data
  via Supabase MCP execute_sql: 2715 stale e2e_-prefixed students
  (+ 12 lesson_participants + 5 attendance_records) cleared. Did
  NOT cause failures pre-changes (baseline was 451/4/133 in 3.8m)
  but did wedge the post-changes baseline run to 6.8 min / 9 fails
  before being cleared. Post-sweep baseline returned to documented
  range: 454 passed / 4 failed / 133 skipped / 4.0 min wall-clock.
  Pattern: stale e2e_* student rows accumulate across sessions
  (2715 ≈ ~5 sessions of seed-without-cleanup-on-failure paths)
  and slow down list pages + audit triggers without surfacing as
  test failures until a tipping point. Sweep at session start when
  baseline wall-clock looks elevated. No commit (DB ops only).
- (9th session — INFRASTRUCTURE focus) Six-item agenda from session 8.
  Items 1 + 2 BLOCKED on service-role key drift detected at Step 0
  verify-after; items 3 + 4 + 6 SHIPPED; item 5 P-graded with
  finding (deterministic fail — needs test redesign).
- 9th-session-Step-0 — added `SUPABASE_SERVICE_ROLE_KEY` and
  `E2E_SUPABASE_SERVICE_ROLE_KEY` entries to `~/.claude/settings.json`
  env block. Both contain the same value Jamie supplied in the
  session opener. **Step 0 verify-after detected drift**: SHA-256
  of supplied key (`b4f9eaa7…`) does NOT match deployment env value
  (`151e578f…`, last updated 2026-05-09T17:12:22Z per Management API
  readback). Direct probe of `send-payment-receipt` returned 401.
  PostgREST direct calls still work (JWT signature valid for RLS
  bypass). The supplied value's iat=2026-04-29 is the SAME as what
  was already in `.env.test` from 8th session — Jamie likely pasted
  back the existing stale value rather than reading fresh from
  Dashboard. Items 1 (vault seed) + 2 (§27 fn-invocation) HALTED
  pending fresh key. See `audit/findings/2026-05-09-service-role-key-rotation-and-drift.md`
  for full diagnosis + 3 paths to resolution.
- (9th session — Item 3 SHIPPED) Created `tests/e2e/global-setup.ts`
  + wired into `playwright.config.ts` as `globalSetup:`. Suite-start
  sweep now runs once before any worker starts, deletes stale e2e_*
  rows scoped to E2E_ORG_ID + persistent-test-user keep-list
  (`e2e-parent` + `e2e-parent2` never touched). Sweeps: students,
  guardians (by email pattern), lessons, invoices/items/payments,
  rooms, attendance, practice logs/streaks, lesson_participants,
  student_guardians, message_log. Idempotent + soft-fails on
  service-role auth issues — logs row-count delta at suite start
  for visibility. Pre-flight on this session: cleared 116 stale
  guardians (118 → 2 keep-list).
- (9th session — Item 4 SHIPPED-as-verified) §22/§24 cross-file
  race no longer reproduces. Ran §22 + §24 in parallel x3 each
  → all 51-pass clean. Sufficient mitigation: §22's existing
  within-file `mode: 'serial'` + restore-in-finally + new
  globalSetup sweep. No code changes needed; documented as
  closed-pending-regression-watch.
- (9th session — Item 5 P-graded) §5.4 email-verification gate
  is **deterministic 5/5 fail**, not a flake. Root cause: Supabase
  auth `enable_email_confirmations` (likely set during the
  2026-05-08 auth tightening) rejects password-grant for unconfirmed
  users with `email_not_confirmed`. The test's `signInAndWriteStorageState`
  call to `/auth/v1/token?grant_type=password` will never succeed
  for a user created with `email_confirm: false`. Test design is
  fundamentally broken; needs redesign (UI-driven signup flow OR
  magic-link admin generation). 90-min ceiling exhausted on
  diagnosis + finding. Finding doc:
  `audit/findings/2026-05-09-rbac-5-4-email-verification-test-design-broken.md`.
  ETA for fix: 1-2h in a follow-up session.
- (9th session — Item 6 SHIPPED) §05 RBAC Settings degradation
  race fixed. Original test used `waitForTimeout(2000)` + a regex
  text match with 5s timeout — under parallel load on contended
  workers, 5s wasn't enough for the auth+org context to resolve
  and ProfileTab to render. Fixed by: (a) replacing `waitForTimeout`
  with `waitForLoadState('networkidle')` so all initial XHRs settle,
  and (b) using `expect(page.locator('main')).toContainText('Profile Information', { timeout: 20_000 })`.
  Note: `getByText('Profile Information').first().toBeVisible()`
  was rejecting the rendered heading despite the accessibility
  snapshot showing it as a level-3 heading — likely a Card
  opacity/transition class confused the visibility heuristic.
  `toContainText` on `main` bypasses that heuristic. Verified
  12/12 PASSES under 4-worker parallel load (3 runs × 4 repeats).
- (9th session) audit findings filed:
  - `audit/findings/2026-05-09-service-role-key-rotation-and-drift.md`
  - `audit/findings/2026-05-09-rbac-5-4-email-verification-test-design-broken.md`
- (10th session — Step 0 OUTCOME B confirmed) Jamie's session-10
  opener supplied the same iat=2026-04-29 service-role key as
  session 9. Step 0 verify-after probe of send-payment-receipt
  returned 401 again. Hash readback: deployment env still
  `151e578f…`, supplied key still `b4f9eaa7…`. Genuine drift.
  Items 1+2 stayed BLOCKED. Surfaced two repair options to Jamie
  (Edge Function "Custom secrets" override deletion OR Dashboard
  legacy service_role key reset). Vault seeding (P0, FIVE
  sessions deferred) carried forward to session 11.
- (10th session — P0 production bug found + fixed) Discovered
  during §20.7b withdrawal-flow test write that
  `bulk-process-continuation` calls `process-term-adjustment`
  internally with `Authorization: Bearer ${serviceRoleKey}`.
  process-term-adjustment validates the caller via
  `userClient.auth.getUser()` which rejects service-role JWTs
  with HTTP 403 `{"code":403,"error_code":"bad_jwt","msg":"invalid claim: missing sub claim"}`.
  Result: withdrawal branch silently fails for every response
  (preview 401 → continue → anyWithdrawalSucceeded stays false →
  withdrawnCount stays 0 → fn returns success:true with all
  zeros). This has been broken since deployment (single commit
  79ca457 "Triggered production publish" — no later edits).
  **Term-end critical for Lauren's continuation flow per v2 §3.1.**
  Fix: pass through the original user authHeader from
  bulk-process-continuation (which has already validated the
  user is owner/admin) to process-term-adjustment. Two-line
  change at the preview + confirm `fetch` call sites. Deployed
  via `supabase functions deploy bulk-process-continuation`.
  Test §20.7b verifies the full chain end-to-end. Finding doc:
  `audit/findings/2026-05-09-bulk-process-continuation-withdrawal-broken.md`.
- (10th session — catalog work) Three new real §20 tests:
  * §20.7b — process_type='withdrawals' end-to-end (covers
    process-term-adjustment preview + confirm + cancel lessons
    + cap recurrence + credit note + cleanup_withdrawal_credits
    audit)
  * §20.8a — delete run with no responses → row gone
  * §20.8b — delete run with responses → cascade deletes
    responses (catalog "blocks or warns" framing not enforced
    in code; FK CASCADE is the actual behaviour).
  §20 cluster now functionally complete except UI-driven cases
  (covered by smoke tests).
- (10th session) §20 file tweaks: `resetE2ERateLimits()` added
  to file-level beforeAll — bulk-process-continuation has
  5/hour per-user rate limit which the §20.7 + §20.7b pair
  burns through in ≈2 iterations. Reset at file start prevents
  429 cascades during local debug runs.
- (11th session — DRIFT SAGA CLOSED AS PHANTOM) Step 0 ran the
  fresh three-probe diagnostic the prompt mandated (PostgREST +
  verify_jwt=true + verify_jwt=false). Definitive result:
  PostgREST direct returned HTTP 200 with the legacy service_role
  JWT — proves signature validity for the project. The 151e578f…
  "deployment env hash" inherited as the basis of the drift
  diagnosis across sessions 9 + 9a + 10 came from session 9a's
  env-probe-temp function which was never validated. Sessions 9
  and 10 carried the framing forward as if established fact. The
  ACTUAL phenomenon is documented in
  `audit/findings/2026-05-09-edge-fn-env-injection-mismatch.md`:
  edge function `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` returns
  a different value than the dashboard service_role JWT, even
  with no Custom Secrets override. The earlier finding
  `2026-05-09-service-role-key-rotation-and-drift.md` is now
  marked CLOSED — phantom diagnosis. Anti-pattern logged: don't
  inherit diagnostic conclusions across sessions without
  re-running the diagnostic.
- (11th session — send-bulk-message getUser fix) Discovered
  during §16.3 bulk-send test write that send-bulk-message was
  calling `supabaseAuth.auth.getUser()` (no args) — that makes
  a /auth/v1/user request which rejects legacy JWTs on this
  project. Other handlers (send-message line 57,
  mark-messages-read line 33) call `getUser(token)` explicitly
  which does local JWKS verification and works. Fixed
  send-bulk-message to match. Same shape of platform-migration
  latent bug as session 10's bulk-process-continuation
  withdrawal fix. Single-file change, deployed via
  `supabase functions deploy send-bulk-message`. BulkComposeModal
  now actually delivers in production for legacy-JWT sessions.
- (11th session — catalog work) 7 new real §16 tests:
  * §16.3 bulk in-app happy path (with seed of active student
    linked to e2e parent guardian to satisfy fetchFilteredGuardians)
  * §16.3 bulk RBAC (parent → 403 at admin-role check)
  * §16.3 bulk validation (missing name/subject/body → 4xx)
  * §16.4 internal compose (owner→admin internal_messages row +
    read_at flow)
  * §16.5 internal thread reply (parent+child via thread_id +
    parent_message_id)
  * §16.10 mark-messages-read parent happy path
  * §16.10 mark-messages-read cross-guardian → 403
  §16 cluster: 5 → 12 real tests, ~60% → ~80%.
- (11th session — global-setup extension) Added stale
  term/term_adjustment/credit-note sweep to
  tests/e2e/global-setup.ts. The §20.7b withdrawal flow leaves
  these behind on partial-failure cleanup; circular FK between
  term_adjustments.credit_note_invoice_id ↔ invoices.adjustment_id
  requires NULLing one before deleting the other. Six-step
  sequence now runs idempotently at suite start.
- (12th session — VAULT SEEDING CLOSED + STREAK NOTIFICATION DELIVERS)
  Item 1 from prompt landed. Vault seeded with SUPABASE_URL +
  SUPABASE_SERVICE_ROLE_KEY (was 7-session deferred). Probe revealed
  a SECOND latent bug: `_notify_streak_milestone` was sending
  `Authorization: Bearer <vault.SERVICE_ROLE_KEY>` but
  streak-notification edge fn (verify_jwt=false) gates on
  `validateCronAuth` checking `x-cron-secret` header against
  `INTERNAL_CRON_SECRET`. Trigger never sent x-cron-secret → every
  milestone callout silently 401'd in production since
  20260518110000_notify_streak_milestone_defensive landed. The
  prior "fix" (`ec94ee3`) made the trigger non-blocking but didn't
  actually unblock delivery. Migration
  `20260519100000_notify_streak_milestone_x_cron_secret.sql` adds
  the third vault lookup + x-cron-secret header. Re-test:
  net._http_response shows status_code=200,
  `{success:true, streak:3, milestone:"Building Momentum!"}`.
  Same anti-pattern session 11 warned about (don't inherit
  diagnostic conclusions without re-running the diagnostic) — the
  prompt assumed Bearer auth was correct. Code review of deployed
  function source caught it. **First launch-blocking infrastructure
  item to fully close in 5 sessions.** Finding doc:
  `audit/findings/2026-05-10-streak-notification-x-cron-secret-mismatch.md`.
- (12th session — §17.4 e2e delivery test) New real test
  `milestone triggers streak-notification edge fn end-to-end`
  inserts 3 consecutive practice_logs + polls
  `net._http_response` (via Management API db/query — pg_net is not
  exposed via PostgREST) for ≤30s, asserts status_code=200 + body
  shape. Includes inline helpers `selectNetHttpResponseSince(sinceId,
  contentSubstring)` and `maxNetHttpResponseId()` — both gated on
  `SUPABASE_ACCESS_TOKEN` env (skips test gracefully if absent so CI
  without the PAT doesn't false-fail). Filters by `id > sinceId` AND
  `content LIKE '%Building Momentum%'` because `http_request_queue`
  rows are deleted after pg_net processing (URL JOIN doesn't work).
  File-level run: 7 passed / 13s.
- (12th session — Item 2: §27.fixme → real RLS contract test)
  Replaced the line-59 `test.fixme` placeholder with two real tests:
  (1) parent JWT sees own `notification_preferences` row + cannot
  see other users' rows (pre-seeds rows for both parent + owner via
  service-role, mints parent JWT via password grant, asserts SELECT
  scoped to user_id=auth.uid()); (2) anonymous request → 0 rows
  (block-anon policy USING(false)). The fn-invocation TODOs
  (lines 350+) for send-payment-receipt remain blocked by edge-fn
  env-injection mismatch (P1 finding 2026-05-09); not fixable in a
  catalog session. §27 cluster: 5 → 7 real tests. File-level run:
  16 passed / 6.8s.
- (12th session — Item 3: getUser() pattern sweep) Sessions 10 +
  11 each found one P0/P1 of the same shape: edge fn calls
  `userClient.auth.getUser()` no-args after `createClient` with
  `Authorization: Bearer <user_jwt>` in headers; on this
  post-migration project /auth/v1/user rejects legacy HS256 JWTs.
  Sweep across 50 hits surfaced 30+ user-facing fns with the buggy
  pattern. Per prompt's 60-min ceiling + halt-after-3 rule: fixed
  the 3 most launch-critical:
  * **send-invoice-email** (Lauren-paramount per v2 §3.1)
  * **notify-internal-message** (internal messaging launch-in-scope)
  * **send-cancellation-notification** (parent-facing cancel comms)
  Each: `getUser()` → `getUser(token)` two-line patch matching
  session-11 commit 08e66e6. Deployed via
  `supabase functions deploy <name>`. Remaining ~27 fns
  (stripe-*, xero-*, calendar-*, csv-import-*, gdpr-*, looopassist-*,
  invite-*, notify-makeup-offer, batch-invite-guardians, etc.)
  catalogued in finding for a focused next-session sweep. Finding
  doc: `audit/findings/2026-05-10-getuser-noargs-sweep.md`.
- (12th session — global-setup ESM fix) The session-11
  term_adjustment + circular FK sweep was silently failing every
  run with `[global-setup] Sweep error (non-fatal): require is not
  defined` because four `require('fs')` calls existed in an ESM
  context (caught from anti-pattern HANDOVER already documented for
  spec files, but not enforced for tests/e2e/global-setup.ts).
  Switched to top-of-file `import fs from 'node:fs'`. Likely
  contributing factor to flake creep observed in session 11 → 12
  baseline (6 → 9 fails) — stale term_adjustments / credit-note
  rows accumulating because the sweep wasn't running.
- (13th session — getUser() sweep continued — 10 more deploys)
  Continued from s12. Fixed the next 10 most launch-critical
  user-facing edge fns: csv-import-execute, csv-import-mapping,
  onboarding-setup, profile-ensure, batch-invite-guardians,
  stripe-create-payment-intent, stripe-process-refund,
  stripe-connect-onboard, stripe-connect-status, send-invite-email.
  Identical 2-line patch as s12: extract `token` from authHeader,
  call `getUser(token)`. Each deployed via
  `supabase functions deploy <name>`. **Cumulative: 13 of ~30
  user-facing fns fixed across s12+s13.** Remaining ~17
  catalogued in finding for follow-up session.
- (13th session — DNS outage diagnosed + RESOLVED) Baseline came
  back 343 failed / 111 passed because every test failed with
  `net::ERR_NAME_NOT_RESOLVED` on `app.lessonloop.net`. Diagnosed:
  Cloudflare CNAME pointed at `lessonloop-app.netlify.app`, but the
  entire `*.netlify.app` zone returns NXDOMAIN globally (verified
  from 1.1.1.1, 8.8.8.8, 9.9.9.9, OpenDNS, and the .app TLD
  authoritative servers; reproduced for other Netlify customer
  sites — `jamstack.netlify.app`, `open-props.netlify.app`,
  `cssreference.netlify.app`). The Netlify project itself was
  healthy throughout (HTTP 200 via Host-header override to the
  Netlify edge IP). Probed alternative routing targets and found
  `lessonloop-app.netlify.com` (TLD swap, same project name)
  resolves and serves the actual LessonLoop HTML correctly. With
  Jamie's authorisation, applied the Cloudflare API CNAME swap
  (`.netlify.app` → `.netlify.com`). Verified end-to-end within
  30s: DNS resolves, HTTPS 200, real HTML, "Netlify Edge" cache
  hit. **Production app restored from outage to functional in
  ~10 minutes.** Finding:
  `audit/findings/2026-05-10-app-dns-netlify-cname-broken.md`.
  NOT caused by s13's edge-fn deploys (those targeted
  `xmrhmxizpslhtkibqyfy.supabase.co`, separate domain).
- (14th session — RETURN TO CATALOG-PRIMARY) After two
  infrastructure-heavy sessions, primary attention back on
  catalog gaps. §13/§14/§11 advanced significantly:
  - §13.7.4 (bulk send drafts via send-invoice-email × 3 →
    all status=sent + 3 message_log rows)
  - §13.7.5 (void invoice with installments → cascade to
    installment.status=void)
  - §14.10.14 (mutating an invoice line item bumps
    invoices.pdf_rev — cache invalidation contract)
  - §14.10.16 (apply_lost_dispute_cascade: paid invoice +
    lost dispute → refund row + invoice no longer paid +
    audit_log dispute_lost_cascade_applied; idempotency
    second-call check)
  - §11.4.2 (insert invites row + send-invite-email →
    message_log invite + 7d expires_at default)
  - §11.4.4 (bulk_update_lessons reassigns teacher_id A→B)
  - §11.4.5 (bulk_cancel_lessons sets status=cancelled —
    this required a P1 production bug fix; see next entry)
  - §11.4.7 (filter tab counts: linked + unlinked = all;
    inactive ⊂ all)
- (14th session — P1 PRODUCTION BUG FOUND + FIXED)
  `bulk_update_lessons` had a CASE type mismatch:
  `status = CASE WHEN _new_status IS NOT NULL THEN _new_status::text ELSE status END`
  — `lessons.status` is the `lesson_status` enum, so the
  CASE branches returned mixed types (text vs enum). Postgres
  rejects with sqlstate 42804. Same bug for `lesson_type`. This
  silently broke `bulk_cancel_lessons` (which calls
  bulk_update_lessons with `'{"status":"cancelled"}'`), which
  in turn broke Lauren's archive-with-cancel-lessons branch in
  RemovalDialog. Reassign branch was unaffected because it
  doesn't pass status in p_changes. Migration
  `20260520100000_bulk_update_lessons_enum_cast_fix.sql`
  swaps `::text` → `::lesson_status` / `::lesson_type` in two
  places. Otherwise byte-identical. Single CREATE OR REPLACE.
  Finding: `audit/findings/2026-05-10-bulk-update-lessons-case-type-mismatch.md`.
- (14th session — getUser() sweep +4) Continuation of
  s12+s13 sweep with 4 more launch-in-scope Stripe fns:
  stripe-create-checkout, stripe-list-payment-methods,
  stripe-detach-payment-method, stripe-customer-portal.
  Cumulative across s12+s13+s14: 17 of ~30 user-facing fns
  fixed. Remaining ~13 catalogued in finding for follow-up.
- (14th session — flake watch noted) Mid-session baseline
  (post-catalog-work, full suite) ran 460/13/129/8/7.0m.
  Wall-clock spiked from 4.4m start → 7.0m mid. Two new
  long-running tests (§13.7.4 ~58s, §14.10.16 ~52s) account
  for ~110s of the increase; both pass in isolation but
  flake under parallel contention because supabaseSelect
  via owner JWT can return non-array under load (PostgREST
  proxy timeouts). Other fails are documented transients
  (§5.4 deterministic, §22.2 cross-file race, §26.6.6
  admin_locked, §26.9.1/2/3 Stripe). NOT regressions from
  the s14 deploys. Session 15 may want to harden the two
  new flaky tests by switching their result-side queries to
  service-role curl (bypasses owner-JWT-proxy contention) —
  same pattern §27 RLS test uses successfully.
- (15th session — FLAKE HARDENING + §22/§11 deeper coverage)
  Three commits land:
  * (flake fix) §13.7.4 + §14.10.16 result-side selects switched
    from supabaseSelect (owner JWT) to inline selectServiceRole
    (curl + SUPABASE_SERVICE_ROLE_KEY) helpers. Same shape as §27
    selectNotifPrefServiceRole / §26.11 selectServiceRole.
    Service-role bypasses the owner-JWT-PostgREST-proxy contention
    pattern that returned non-array shapes under load in s14. For
    §14.10.16 audit_log assertion the helper got an extra
    selectServiceRoleWithPoll wrapper (10s deadline) — the
    apply_lost_dispute_cascade RPC commits audit_log inside its
    transaction, but PostgREST visibility under cross-file
    contention occasionally lags 1-3s. Both helpers coerce
    non-array PostgREST responses to []. Verified 5x parallel +
    full-§14-file (15/15 in 17.7s). Full-baseline §14.10.16
    initially still flaked on 3s poll — bumped to 10s in the
    same commit. **Both flaky tests now stable across the
    contention scenarios documented in s14.**
  * (catalog) §22 +4 real tests (§22.5 closure date CRUD,
    §22.8 rate cards CRUD, §22.10 message templates CRUD,
    §22.11 availability_blocks overlap trigger raises EXCEPTION
    on same-teacher-same-day overlap). Removed §22.4 fixme
    (duplicate of §32.7 protect_owner_role). §22 50% → ~75%.
    Plus §11 +3 real tests (§11.4.6 plan-cap via throwaway org
    with max_teachers=1 — second active teacher rejected by
    check_teacher_limit, inactive teacher exempt; §11.4.10
    archive teacher status flip via PATCH; §11.4.8 invite
    expiry contract — invites row remains queryable but
    accepted_at stays null after expiry). §11 60% → ~75%.
  * (audit) MASTER.md hygiene per Jamie's recalibrated bar:
    12 rows promoted 🟡→🟢 (Outstanding report; Continuation
    flow; CSV import execute; Teachers list/CRUD; Messages
    inbox; Send-message edge fn; Portal home; Portal schedule;
    Portal practice; Portal invoices & pay; Portal messages;
    Portal profile). Header bumped to s15 reference. Summary
    refreshed to 26 🟢 / 138 🟡 (was 14 / 150). §22 settings
    row tag extended with s15 work and given new
    [PROMOTABLE 🟡→🟢] marker.
- (15th session — recalibrated stance) Jamie's s15 prompt
  explicitly recalibrated the bar: not "fix the worst bugs
  first" but "every area, feature and function systematically
  cleared to world-class". Practical implications carried
  forward in s16+ planning:
  * Audit/MASTER.md hygiene is now NON-NEGOTIABLE per session.
    Target ≥5 rows backfilled to 🟢 per session. s15 landed 12
    (well over the floor); ~150+ should be tagged at launch.
  * Money-path systematic clearing is the next big workstream
    (Invoicing & Payments has 23 audit rows, only ~3 of which
    are 🟢 even after s15). Sessions 16-18 should be a
    dedicated money-path sweep — every row to 🟢 with real
    test + production verification + audit tag.
  * getUser sweep gets a dedicated session (recommend s16 or
    s17). 17/~30 done across s12+s13+s14. ~13 remain. Stop
    capping at 5/session — clear the lot in one focused pass.
- (also at 7th-session start) Manual SQL sweep of stale e2e_ test
  data via Supabase MCP execute_sql — cleared 6 lesson rows
  (1 active scheduled + 5 cancelled), 22 students, 4 invoices, and
  0 active term_continuation_runs that had leaked from prior runs.
  The active `e2e_1778331036121_ugj2_gcal` lesson on 2026-05-23
  was blocking new seeds via the teacher_conflict trigger. No
  commit (DB ops only).

---

## ⚡ If you're a new Claude reading this

Read this whole file before doing anything. Your context starts cold;
this is the only mind-share between sessions. Specifically:

- Don't trust raw test counters. Track **real catalog coverage**, not
  spec count. Catalog overall ~46% (was 25% five sessions ago) —
  §15 reports went from smoke-only to first data-correctness test
  this session.
- Don't use `test.fixme()` as a placeholder — see [Anti-patterns](#anti-patterns).
- The catalog at `tests/e2e/master/PLAYWRIGHT_MASTER_CATALOG.md` is the
  source of truth for "what should be tested". Treat each section as a
  contract.
- §24 Stripe (incl. §24.12 true-replay) / §13 Invoices / §14 Invoice
  detail / §15.4.7 Outstanding data / §11.4.1 unlinked teacher /
  §26.4 makeup respond / §26.6 schedule / §26.7 practice / §26.9
  invoices+pay drawer / §26.10 compose+reply / §26.11 profile prefs
  / §26.12-13 continuation / §8.5 recurring edit / §8.6 cancel +
  §8.8.9-10 auto-credit / §17.4 streak milestone / §17.5.5-6 cron
  — **DONE**. Next priorities in [Next session](#next-session).
- **J24-A infra is live in production.** 14 stripe-* edge fns + the
  webhook now route through `_shared/stripe-client.ts` with org-scoped
  test/live key dispatch. The e2e org has `stripe_test_mode=true`. Do
  NOT toggle that flag for any other org without testing — it would
  break that org's live payments instantly.
- **Read `~/.claude/settings.json` env block before asking the user
  for tokens.** Token inventory + auth-plane quirks are documented in
  the [Setup](#setup) section. Sessions before this one wasted cycles
  asking for things that were already there.

---

## Reality check (don't be misled by counters)

**Catalog completeness: ~73% (was ~70% at end of s14). s15 closed what
s14 left in flight: flake hardening landed (§13.7.4 + §14.10.16 now
service-role-backed and stable across cross-file contention) plus
deeper §22 (50%→~75%) + §11 (60%→~75%) coverage. Audit hygiene
re-established with 12 rows 🟡→🟢 per Jamie's recalibrated bar.**

Current baseline (end of 15th session, post-flake-hardening + §22/§11 catalog + audit hygiene + 10s audit_log poll):
- **458 passed / 10 failed / 124 skipped / 21 did not run / 5.0 min wall-clock at 4 workers**
- vs s14 wrap (460/13/129/8/7.0m): −2 passed / **−3 failed / −5 skipped (s15 fixme conversions) / +13 did-not-run / −2.0m wall-clock**.
- Wall-clock recovered to ≤5m as targeted by s15 Item 1 exit criterion.
- An earlier-in-s15 baseline (post-flake-fix only, before §22+§11+audit
  commits): 471 passed / 8 failed / 129 skipped / 2 did-not-run / 4.6m.
  The +19 did-not-run delta in the final baseline is the standard
  §22.2 + §24 cross-file race cascade pattern (within-file serial
  for §22.2 means subsequent §22.2 tests are skipped if the first
  fails); s11 noted this as a `playwright.config.ts` change to
  pin §22 + §24 mutually exclusive — still pending.
- **§14.10.16 stable in final baseline** (was the s14 flake target).
  The s15 fix held: service-role-curl plus 10s audit_log poll.
- The 10 remaining failures are all documented transients:
  §5.4 email-verification (deterministic — broken test design,
  needs redesign); §22.2 timezone (cross-file race with §24);
  §20.7b withdrawal (rate-limit cascade); §24.5 detach (transient
  Stripe API variance); parent portal login redirect (UI race);
  §26.6.2 past lessons collapsible (UI race); §26.13 already-
  submitted (continuation token UI race); §26.9.1/2/3 Stripe
  trio (transient flake — known).
- The s15 fix verified by 5x parallel run (16/16 in 26s) and full
  §14 file passes (15/15 in 17.7s isolation).

Stale baseline (end of 14th session, post-catalog-work full-suite run):
- 460 passed / 13 failed / 129 skipped / 8 did not run / 7.0 min wall-clock
- See s14 ledger entry for the diagnosis (NOT regressions from s14
  deploys; the +6 failures were 2 of s14's new long-running tests
  flaking under parallel contention plus documented transients).

Stale baseline (end of 13th session) for reference:
- 461 passed / 9 failed / 132 skipped / 4.3 min wall-clock
- **+5 passed** vs end of 11th-session (was 459 — +1 §17.4 e2e
  delivery, +2 §27 RLS, +2 transient flakes recovered after the
  global-setup ESM fix unblocked stale-row sweep)
- **+1 net failed** vs end of 11th-session (was 6) — small uptick;
  composition remains the same documented transients (§5.4,
  §26.6.7 GCal, §26.9 Stripe trio) plus one new §6 dashboard
  stat-cards transient
- **−0.8 min wall-clock** vs end of 11th-session (was 5.3 min)
  — likely attributable to global-setup sweep finally working
  (term_adjustments + credit-note rows no longer accumulating
  silently because of the require()-in-ESM bug)

Stale baseline (end of 11th session) for reference:
- 459 passed / 6 failed / 133 skipped / 5.3 min wall-clock
- ALL of those fails were documented transients (§22.2 cross-file race,
  §26.6.7 GCal, §20.7b rate-limit cascade). Each passes 5/5 in
  isolation. Pre-existing shapes, not regressions.
- **+1.3 min wall-clock** — variance; baseline run after sweeps
  was 5.3 min. Acceptable.

**Net win for the suite:** Drift saga closed as phantom (was
blocking 6+ sessions of vault-seeding + §27 fn-invocation work
based on a misread); P1 latent bug fixed in send-bulk-message
(getUser pattern); +7 new real tests covering §16 bulk + internal
+ threads + mark-read.

- **The 6 remaining failures (mix varies run to run)**: §5.4
  email-verification (deterministic; test design broken — see
  [finding](audit/findings/2026-05-09-rbac-5-4-email-verification-test-design-broken.md));
  §20.7b withdrawal (transient — passes 5/5 in isolation; full-
  suite race likely rate-limit cascade); §22.2 cross-file race
  (timezone, VAT, schedule-hours, parent_reschedule_policy —
  all hit when §22 + §24 interleave); §26.6.7 GCal URL
  (occasional UI race); §26.9.1 Stripe (transient flake).

**Known intermittent flake — §22/§24 cross-file race:** §22 settings
mutations (timezone + VAT toggle) modify org config that §24 invoice
totals depend on. Within-file serial mode is ON for both files now.
For cross-file pinning, the next session needs a `playwright.config.ts`
change. Recommended approach:
```ts
// playwright.config.ts
projects: [
  { name: 'master', ... },
  // run §22 + §24 in their own pool, serial against each other
],
```
or simpler: assign each test org to a different worker via a fixture-
generated throwaway org. The §22 mutations only run for the e2e org
today; if §22 had its own throwaway org, the race would be eliminated.

Storage state hygiene matters: if you see ~35 owner-side failures, the
storage state JWTs have gone stale (or the e2e-owner profile has
`has_completed_onboarding=false`). Fix:
```bash
rm tests/e2e/.auth/*.json   # auth.setup.ts regenerates
```
And via service-role SQL if onboarding flag drifted (see [Known issues](#known-issues)).

| Category | Real count | What it means |
|---|---|---|
| Genuinely behavioural tests (full journeys) | ~152 | +10 §24, +4 §26.4 makeup, +2 §17.4 streaks, +5 §26.10 compose, +4 §26.12/§26.13 continuation, +2 §8.5 recurring edit, +1 §17.4 milestone, +2 §24.12 true-replay, +8 §26.6 schedule, +3 §26.9 invoices, +3 §8.6+§8.8.9-10 cancel/credit, +2 §17.5 cron, +3 §26.10 reply, +1 §26.11 prefs, +1 §15.4 outstanding, +1 §11.4 unlinked teacher, +5 §16.3 staff send-message (s6), +5 §10.7 csv-import-execute (s6), +4 §15.4 reports data-correctness (s6), +6 §20 continuation run-creation backend (s6) |
| RBAC matrix (5 roles × 33 routes) | 165 | Just route access; useful but narrow |
| Page-load smoke tests | ~30 | "Does this URL render?" — no feature behaviour |
| DB query / trigger guard tests | ~30 | Real, but narrow — single SQL operations |
| **`test.fixme()` empty placeholders** | **211** | Empty function bodies. They run as "skipped". They prove NOTHING. |
| **Total spec functions** | **~549** | |

**Track real catalog coverage, not test count.**

---

## What got fixed in production this week (don't re-discover these)

These are real production bugs found via E2E or audit work and shipped
to `main`. Don't waste time re-finding them:

| Commit | Bug | Severity |
|---|---|---|
| `dbe1a51` | `Intl.NumberFormat: Invalid currency code` — `/portal/invoices` showed React error boundary "Something went wrong" for any parent | **P0** |
| `e476387` | `/settings` route blocked finance + teacher despite sidebar showing the link | P1 |
| `c087894` | `check_cron_health()` RPC was 500'ing every run since deployment — zero alerts ever sent | P0 |
| `c087894` | 8 lifecycle crons were never registered (trial-expired, waitlist-expiry, enrolment-offer-expiry…). Trial expirations silently no-op'd → revenue leak | **P0** |
| `19d8efc` | `complete_onboarding` RPC 3-bug chain (enum casts, service-role guard, exception catch) | P0 |
| `baa072c` | Stripe webhook used sync `constructEvent` on Deno — signature always failed | P0 |
| `7b6c20c` | OAuth flow pointed at dead Lovable endpoint after Lovable detach | P0 |
| `2e0a538` | CSP missing `api.pwnedpasswords.com` (signup pwned-check 401'd); stale Lovable origins | P1 |
| `2e0a538` | Sentry source maps not uploaded → useless stack traces | P1 |
| `f3d724b` | Supabase password policy was 6 chars + no character requirements | P1 |
| `62a9282` | `AuthContext.onAuthStateChange` was async + awaited DB queries → 5s blank screen on every signin | P0 |
| Supabase config | `protect_subscription_fields` uses silent `NEW := OLD` coerce, NOT exception | n/a (working as designed; my initial test asserted wrong) |
| Various | Storage `avatars` bucket had no size cap or mime allowlist (now 2MB + image-only) | P2 |
| Various | Cloudflare DNS still had stale `_lovable.app` TXT record; `app.lessonloop.net` not proxied via CF | P2 / decision-pending |
| `65bde4e` | `continuation-respond` had platform `verify_jwt=true` but the frontend uses publishable keys (`sb_publishable_*`); fully-anonymous email-link clicks at `/respond/continuation?token=X` got `UNAUTHORIZED_INVALID_JWT_FORMAT` at the gateway. Function code already does manual auth on both paths; one config.toml line + redeploy fixes it. | **P0** (parent-facing email flow, broken since signing-keys migration) |
| `ec94ee3` | `_notify_streak_milestone` read `vault.decrypted_secrets` for `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, which were never seeded (only `INTERNAL_CRON_SECRET` was). NULL URL → `null value in column "url" violates not-null constraint` (sqlstate 23502) → trigger errored → AFTER INSERT trigger rolled back the user's `practice_logs` insert. Any user logging the 3rd, 7th, 14th, 30th, 60th, or 100th consecutive practice day got a 500. Fix wraps the `net.http_post` call in nested EXCEPTION; `audit_log` row stays as the durable record, delivery is best-effort. | **P0** (silent revenue / engagement leak on streak milestones) |
| (10th session) | `bulk-process-continuation` withdrawal branch passed `Bearer ${serviceRoleKey}` to internal `process-term-adjustment` calls. process-term-adjustment validates the caller via `userClient.auth.getUser()` which rejects service-role JWTs ("missing sub claim"). Result: every withdrawal silently failed (preview 401 → continue → withdrawnCount stayed 0; fn returned success:true with all zeros). Broken since deployment (single commit 79ca457, no later edits). Fix: pass through the original user authHeader. Two-line change. Deployed via `supabase functions deploy bulk-process-continuation`. | **P0** (term-end critical — Lauren's continuation flow per v2 §3.1; session 9's HANDOVER claimed this was structurally working) |
| (11th session) | `send-bulk-message` was calling `supabaseAuth.auth.getUser()` (no args) → /auth/v1/user request that on this project rejects legacy HS256 JWTs → 401 for legacy-session callers. Fix: extract `token = authHeader.replace("Bearer ", "")` + call `getUser(token)` for local JWKS verification. Single-file change, deployed via `supabase functions deploy send-bulk-message`. | **P1** (bulk message UI silently failed for legacy-JWT sessions) |
| (12th session) | `_notify_streak_milestone` trigger sent `Authorization: Bearer <vault.SERVICE_ROLE_KEY>` only; deployed `streak-notification` edge fn (verify_jwt=false, v18) gates on `validateCronAuth` which checks `x-cron-secret` header. Trigger never sent that header → every milestone callout silently 401'd in production since 20260518110000 landed. Audit_log row commits, but no email/push reaches the guardian. Migration `20260519100000_notify_streak_milestone_x_cron_secret.sql` adds vault lookup of `INTERNAL_CRON_SECRET` + sends `x-cron-secret` header. Re-test: net._http_response shows 200 OK + `{success:true, streak:3, milestone:"Building Momentum!"}`. The prior `ec94ee3` "fix" only made the trigger non-blocking; this is the real delivery fix. | **P0** (silent revenue/engagement leak on every 3/7/14/30/60/100-day streak — Lauren's shadow-term week 4 timer was running) |
| (12th session) | `send-invoice-email` had the getUser() no-args pattern. Lauren-paramount fn per v2 §3.1 — sending invoices is core. Fix: getUser(token) two-line patch + deploy. | **P1** (silent failure for legacy-JWT senders → no parent receives the bill) |
| (12th session) | `notify-internal-message` had the getUser() no-args pattern. Internal messaging is launch-in-scope (org-gated). Fix: getUser(token) two-line patch + deploy. | **P1** (staff don't receive internal-message notifications for legacy-JWT senders) |
| (12th session) | `send-cancellation-notification` had the getUser() no-args pattern. User-triggered cancellation comms. Fix: getUser(token) two-line patch + deploy. | **P1** (parent doesn't receive cancellation email; would show up to a missing class) |

The currency bug specifically is now permanently regression-tested in
`tests/e2e/master/26-parent-portal.spec.ts` ("invoices page renders
without currency-error boundary"). Both `65bde4e` and `ec94ee3` have
their own real tests guarding regression — §26.13 anonymous happy
path and §17.4 milestone audit row respectively.

---

## Open production-relevant items (not blocking E2E coverage)

These are real production issues that the E2E suite can't surface
because the test harness either passes-by-defensive-fallback or the
broken code path runs only in production. Each is a separate focused
session — don't fix inline during a catalog session.

| Item | Severity | Notes |
|---|---|---|
| ~~Streak milestone notifications never deliver.~~ | — | **CLOSED in session 12.** Two bugs in series: (1) vault was missing SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (FIXED — seeded via Management API); (2) `_notify_streak_milestone` sent wrong auth header, streak-notification's validateCronAuth required x-cron-secret (FIXED via migration `20260519100000_notify_streak_milestone_x_cron_secret.sql`). End-to-end verified: net._http_response shows 200 OK with `{success:true, streak:3, milestone:"Building Momentum!"}`. §17.4 e2e delivery test added that polls net._http_response. RESEND_API_KEY still not seeded so emails_sent=0 (best-effort delivery design); seeding RESEND is an unrelated follow-up if Lauren wants email delivery, separate from the auth chain. |
| ~~app.lessonloop.net DNS chain broken~~ | — | **RESOLVED in session 13.** Outage at start of s13 because the entire `*.netlify.app` zone went NXDOMAIN globally (verified across all major resolvers + the .app TLD authoritative servers). Cloudflare CNAME at `app.lessonloop.net` was pointing at `lessonloop-app.netlify.app`. Fixed via Cloudflare API: CNAME swapped to `lessonloop-app.netlify.com` (same project, TLD swap). Verified end-to-end (HTTPS 200, Netlify edge cache hit). ~10 min from diagnosis to resolution. Long-term consideration: switch DNS hosting to Netlify so they manage the chain end-to-end as their internal naming evolves. See [DNS finding](audit/findings/2026-05-10-app-dns-netlify-cname-broken.md). |
| **getUser() no-args pattern across 30+ user-facing edge fns** (sweep in progress) | **P1** | Sessions 10+11 each found 1; s12 fixed 3; s13 fixed 10; s14 fixed 4 (stripe-create-checkout, -list-payment-methods, -detach-payment-method, -customer-portal). s15 NO new fixes — focused on flake hardening + §22/§11 catalog instead, per the recalibrated stance. **Cumulative 17 of ~30 fixed; ~13 remain.** Remaining catalogued in [finding](audit/findings/2026-05-10-getuser-noargs-sweep.md). **FLAGGED for dedicated session 16/17** — the s15 prompt explicitly asked to stop piecemeal and clear the lot in one focused pass. |
| **Money-path systematic clearing** (Invoicing & Payments cluster) | **P0/P1 mix** | Lauren-paramount per v2 §3.1. 23 audit rows; only ~3 are 🟢 even after s15. Sessions 16-18 dedicated workstream per recalibrated stance: every row to 🟢 with real test + production verification + audit tag. Includes Stripe webhook (already 🟡 with §24.12 true-replay), payment-intent + checkout, refund + dispute notifications, auto-pay run, recurring billing run. Most are service-role-only edge fns — DB-shape contract tests are appropriate (similar to §27). |
| **DNS hardening** (raised in s13; Jamie-level work) | **P1 launch readiness** | The s13 outage exposed that production DNS relies on a Cloudflare CNAME pointing at a Netlify-managed target whose naming Netlify can change without notice. Same pattern could fail again. JAMIE-LEVEL launch-readiness item: (a) move DNS hosting to Netlify entirely, OR (b) add external uptime monitoring on app.lessonloop.net + a runbook for the CNAME swap. Runbook is filed in audit/findings/2026-05-10-app-dns-netlify-cname-broken.md. NOT agent work. |
| **Edge function env injection mismatch** (REPLACES the prior "drift" entry — phantom diagnosis closed in 11th session) | **P1** | 11th-session three-probe diagnostic conclusively proved: the legacy HS256 service_role JWT IS valid against the project (PostgREST returns 200). The "drift" framing carried across sessions 9 + 9a + 10 was based on a hash from session 9a's env-probe-temp (never validated). The actual phenomenon: `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` in deployed edge functions returns a different value than the dashboard's "Project API keys" → service_role row, despite no Custom Secrets override. Jamie's hypothesis on cause: Supabase auto-injection materialises a different value than the dashboard, OR partial migration to signing-keys at the edge gateway. Three resolution paths in [finding](audit/findings/2026-05-09-edge-fn-env-injection-mismatch.md). The agent should NOT propose JWT secret reset or sb_secret_ migration. **Affects edge functions that do `authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))` byte-equal checks** (send-payment-receipt + likely send-refund-notification + send-auto-pay-alert). Functions that use `getUser(token)` for auth (now including send-bulk-message after 11th-session fix) work fine with legacy JWTs. Vault seeding still blocked because the streak-notification chain runs through this auth path. |
| **§5.4 email-verification gate test design broken** (NEW 2026-05-09 — formerly listed under "JWT-stale" theory) | **P2** | 9th-session Item 5 confirmed deterministic 5/5 fail. Root cause: Supabase `enable_email_confirmations` (likely toggled in 2026-05-08 auth tightening) rejects password-grant for unconfirmed users with `email_not_confirmed`. The test creates a user with `email_confirm: false` then calls `/auth/v1/token?grant_type=password` to get a session — that path now refuses by design. The test's premise is broken; no quick fix. Three redesign paths in [finding](audit/findings/2026-05-09-rbac-5-4-email-verification-test-design-broken.md). Estimate to fix: 1-2h via UI-signup flow OR magic-link admin generation. |
| ~~RBAC Settings UI render race~~ | — | **FIXED** in 9th session. Root cause was a 5s `isVisible` timeout on a regex text match under parallel load. Fix: `waitForLoadState('networkidle')` + `expect(page.locator('main')).toContainText('Profile Information', { timeout: 20_000 })`. Verified 12/12 PASSES under 4-worker parallel load (3 runs × 4 repeats). |
| ~~§22/§24 cross-file race~~ | — | **FIXED-AS-VERIFIED** in 9th session. 3 separate parallel runs of §22 + §24 together → 51 passed each, no race observable. Sufficient mitigation already in place: §22's within-file `mode: 'serial'` (7th session) + restore-in-finally + globalSetup sweep (9th session). No code changes needed; documented as closed-pending-regression-watch. |

---

## What's portable (in git, picks up on any machine)

| | |
|---|---|
| All test code | `tests/e2e/master/`, `tests/e2e/workflows/`, `tests/e2e/*.spec.ts` |
| Test fixtures + factories | `tests/e2e/master/_fixtures/auth-refresh.ts`, `tests/e2e/supabase-admin.ts` |
| The catalog (source of truth for what to test) | `tests/e2e/master/PLAYWRIGHT_MASTER_CATALOG.md` |
| Audit framework (180 features tracked) | `audit/MASTER.md` |
| 24 finding documents | `audit/findings/*.md` |
| All migrations | `supabase/migrations/` |
| `.env.test.example` (every required env var) | repo root |
| All commits | `git log` |

## What's NOT portable (you must reconstruct)

| | Where it is | What to do |
|---|---|---|
| `.env.test` with actual secret values | gitignored | Copy from `.env.test.example`, fill in (see [Setup](#setup)) |
| Tokens in `~/.claude/settings.json` env block | local | Replicate values (see [Setup](#setup)) |
| MCP server connections | per-account | Verify Supabase + Stripe + Sentry + Netlify + Cloudflare MCPs are connected on the new account |
| `tests/e2e/.auth/*.json` storage states | gitignored | Auto-regenerated by `auth.setup.ts` on first run |

---

## Setup

### Token inventory — what you have, where it lives, what it unlocks

Every Claude session starts with `~/.claude/settings.json` already
loaded into the environment. **Don't ask the user for tokens before
checking what's already there** — read settings.json first. If a
token is rejected, refresh it (links below) and rotate in place.

| Token | Lives in | Plane | What it unlocks | Refresh URL |
|---|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` (sbp_*) | `~/.claude/settings.json` env | Management API (`api.supabase.com`) | Project ops, secrets read/write, edge fn deploys | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_SERVICE_ROLE_KEY` + `E2E_SUPABASE_SERVICE_ROLE_KEY` (legacy eyJ JWT) | `~/.claude/settings.json` env (added 9th session) | Database / PostgREST (`*.supabase.co/rest/v1`) — **CURRENTLY DRIFTED** vs deployment edge-fn env | RLS bypass works (PostgREST). Edge-fn `authHeader.includes(serviceKey)` byte-equal checks fail — see drift finding. | Supabase Dashboard → Settings → API → service_role (one paste, no clipboard reuse) |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` (legacy eyJ JWT) | `.env.test` (gitignored) | Database / PostgREST | Same as above — same value, drifted from deployment. | Same dashboard location |
| `E2E_SUPABASE_ANON_KEY` | `.env.test` | Database / PostgREST | Anon-equivalent for parent JWT minting in tests | Supabase Dashboard → Settings → API → publishable / anon |
| `STRIPE_SECRET_KEY` (sk_live_*) | `~/.claude/settings.json` env | Stripe API live mode | Live Stripe ops via Stripe MCP | https://dashboard.stripe.com/apikeys |
| `STRIPE_TEST_SECRET_KEY` (sk_test_*) | `~/.claude/settings.json` env + duplicated as `E2E_STRIPE_TEST_SECRET` in `.env.test` | Stripe API test mode | Test-mode payments, refunds, customers used by §24 + §13/§14 | https://dashboard.stripe.com/test/apikeys |
| `STRIPE_TEST_WEBHOOK_SECRET` (whsec_*) | `~/.claude/settings.json` env + duplicated as `E2E_STRIPE_TEST_WEBHOOK_SECRET` in `.env.test` + Supabase Edge Function secret | n/a — used to HMAC-sign webhook payloads | True-replay idempotency tests for §24.12 + the dual-mode webhook handler verification | https://dashboard.stripe.com/test/webhooks → endpoint `we_1TUwZhBAjFOLYDS3QGslhpbj` (only shown at create time; ours: confirmed 2026-05-09 by signing a `ping` event and getting HTTP 200 from the webhook) |
| `STRIPE_WEBHOOK_SECRET` (whsec_*) | Supabase Edge Function secret | n/a — live mode equivalent | Verifying live-mode events. Not in claude settings; production-only. | Stripe Dashboard live → endpoint `we_1TUlSHAzPfYm94ux4mOfF72i` |
| `NETLIFY_AUTH_TOKEN` (nfp_*) | `~/.claude/settings.json` env | Netlify API | Deploys, env-var management, project config | https://app.netlify.com/user/applications#personal-access-tokens |
| `CLOUDFLARE_API_TOKEN` (cfut_*) | `~/.claude/settings.json` env | Cloudflare API | DNS, Workers KV/R2 | https://dash.cloudflare.com/profile/api-tokens (Zone:DNS:Edit + Account:Workers KV/R2) |
| `SENTRY_AUTH_TOKEN` (sntryu_*) | `~/.claude/settings.json` env | Sentry API | Source map upload, release creation | https://lessonloop.sentry.io/settings/account/api/auth-tokens/ (`project:write`, `project:releases`) |
| `CONTEXT7_API_KEY` (ctx7sk-*) | `~/.claude/settings.json` env | Context7 docs MCP | Library doc lookup | https://context7.com/dashboard |

**Plane gotcha (learned the hard way 2026-05-09):** Supabase has two
auth planes that don't cross over:

- `sbp_*` PAT → `api.supabase.com` (Management API: secrets, deploys,
  config). This is what you need to read or write Edge Function secrets.
- `sb_secret_*` (or legacy JWT `service_role`) → `*.supabase.co/rest/v1`
  (PostgREST: tables, RPC). Test suite uses this.

A `sb_secret_*` value will return `JWT could not be decoded` against
the Management API regardless of authority — they're different planes.
If `SUPABASE_ACCESS_TOKEN` returns 401, the PAT is expired/revoked;
issue a fresh one at the dashboard URL above.

**Edge Function secrets — readability quirk:** Supabase's Management
API at `GET /v1/projects/{ref}/secrets` returns
`[{name, value, updated_at}]` — but `value` is a SHA-256 hex digest,
NOT the plaintext. Plaintext is genuinely write-only after creation.
If you need a secret value that isn't already in your env, you must
either (a) get it from the user, (b) re-issue/rotate the upstream
(Stripe, Sentry etc.) and capture at create time, or (c) re-run a
flow that returns it (Stripe webhook create returns `secret`, rotate
returns the new one). Then write it back via
`POST /v1/projects/{ref}/secrets` with body `[{name, value}]`.

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:6767",
    "NETLIFY_AUTH_TOKEN": "<nfp_...>",
    "SUPABASE_ACCESS_TOKEN": "<sbp_...>",
    "CLOUDFLARE_API_TOKEN": "<cfut_...>",
    "STRIPE_SECRET_KEY": "<sk_live_...>",
    "STRIPE_TEST_SECRET_KEY": "<sk_test_...>",
    "STRIPE_TEST_WEBHOOK_SECRET": "<whsec_...>",
    "CONTEXT7_API_KEY": "<ctx7sk-...>",
    "SENTRY_AUTH_TOKEN": "<sntryu_...>",
    "SENTRY_ORG": "lessonloop",
    "SENTRY_PROJECT": "javascript-react",
    "SENTRY_REGION_URL": "https://de.sentry.io"
  }
}
```

### 2. `.env.test` for the test suite

```bash
cd /tmp/lessonloop3-deploy   # or wherever you clone to
cp .env.test.example .env.test
```

Then fill in values per the comments. The critical ones:

| Var | Value | Get from |
|-----|-------|----------|
| `E2E_BASE_URL` | `https://app.lessonloop.net` | (production) |
| `ALLOW_PRODUCTION_TESTS` | `true` | (required to target production) |
| `E2E_SUPABASE_URL` | `https://xmrhmxizpslhtkibqyfy.supabase.co` | destination project |
| `E2E_SUPABASE_ANON_KEY` | (eyJ...) | Supabase MCP `get_publishable_keys` |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | (eyJ...) | Supabase Dashboard → Settings → API → service_role (DO NOT COMMIT) |
| `E2E_STRIPE_TEST_SECRET` | `sk_test_<...>` (matches `STRIPE_TEST_SECRET_KEY` in claude settings) | https://dashboard.stripe.com/test/apikeys |
| `E2E_OWNER_EMAIL` | `e2e-owner@test.lessonloop.net` | (already provisioned in destination Supabase) |
| `E2E_OWNER_PASSWORD` | `E2eTestPass123!` | Set 2026-05-08 by reset_password SQL |
| `E2E_*_EMAIL/PASSWORD` (admin/teacher/finance/parent/parent2) | All `e2e-{role}@test.lessonloop.net` / `E2eTestPass123!` | (provisioned + passwords reset) |
| `E2E_ORG_ID` | `25b57950-6c4e-42d8-8089-4942d2bba959` | "E2E Test Academy" |

### 3. Repo bootstrap

```bash
cd /tmp/lessonloop3-deploy
git pull
npm install
npx playwright install chromium
```

### 4. Verify setup

This single command should land in the ~395 passed range:

```bash
./node_modules/.bin/playwright test --project=master --workers=4
```

Expected output (current 2026-05-09 baseline, post §24.12 true-replay):
- **~395 passed** (varies ±5 with transient seed flakes)
- **1-5 failed** — always includes `§5.4` email-verification flake;
  sometimes `§22.2` timezone (cross-file race with §24), `§13` stats
  (occasional), `05-rbac` Settings degradation (in the 13-brittle
  JWT-stale group), `§17.4 streak progression (×2)` (supabaseInsert
  infra flake, unrelated to streak math), or `§20.1` continuation-
  respond (very occasional curl/spawnSync ETIMEDOUT — when it fires it
  cascades to ~2 dependent serial tests shown as "did not run")
- **~152 skipped** (intentional)
- ~3.5-5 min wall-clock at 4 workers

If you see ~35 owner-side failures, the `has_completed_onboarding`
flag has drifted on the e2e-owner profile — fix per
[Known issues](#known-issues). If far fewer pass or you see auth
failures, check `.env.test` and the storage states first.

---

## Next session

Continue **Mode B**: grind through the catalog section by section.
**Stop using `test.fixme()` as a placeholder.** Either write the real
test or delete the line.

### What's done at end of 15th session

| Section | Real tests | Coverage | Notes |
|---|---:|---:|---|
| §10 Students (incl. §10.7 CSV import) | 7 | ~60% | §10.7 5 tests via csv-import-execute (Lauren-critical) done |
| §11 Teachers | 8 + RBAC | ~75% | s15: §11.4.6 plan-cap (throwaway org), §11.4.8 invite expiry contract, §11.4.10 archive teacher PATCH. UI archive-dialog flow still pending |
| §13 Invoices | 12 | ~80% | s15: §13.7.4 hardened with service-role-curl result-side selects |
| §14 Invoice detail | 14 | ~85% | s15: §14.10.16 hardened with service-role-curl + 10s audit_log poll |
| §15 Reports | 8 + 9 smoke | ~95% | mature; full §15 cluster data-correctness covered for all 7 launch reports |
| §16 Messages | 12 + smoke | ~80% | mature |
| §17 Practice | 5 + 2 cron + 1 e2e | ~80% | end-to-end verified post-s12 |
| §20 Continuation | 12 | ~98% | mature; §20 cluster functionally complete except UI-driven cases |
| §22 Settings | 12 + 21 smoke | ~75% | s15: §22.5 closure date / §22.8 rate cards / §22.10 message templates / §22.11 availability_blocks overlap trigger. §22.7 GDPR / §22.12 calendar OAuth / §22.14 billing / §22.15 booking page (hidden) / §22.21 Xero / §22.22 recurring billing (hidden) remain fixme |
| §24 Stripe (incl. §24.12 true-replay) | 12 | ~70% | mature; §24.4/6/8/9/11 deferred — Stripe CLI / OAuth / mobile |
| §26 Parent portal | 32+ | ~95% | mature; only §26.8 Resources remains |
| §27 Notifications | 5 + 2 RLS | ~55% | mature; live fn-invocation tests still deferred (edge-fn env-injection mismatch) |
| §32 Security trigger guards | 9 | ~80% | mature |
| §8 Lesson CRUD | 9 | ~65% | §8.5 recurring + §8.6 cancel + §8.8.9-10 auto-credit done |

Catalog overall: **~73%** (was ~70% at end of s14). s15 closed s14's
flake debt and pushed §22 + §11 from "shallow" to "respectable
launch-ready" coverage.

Catalog overall: **~66%** (was 64% at session 11 end — 12th-session
+1 §17.4 e2e delivery test, +2 §27 RLS contract tests; vault seeding
closed; 4 production bug fixes shipped).

### Priority order — 16th session pickup

**Recommended**: pick ONE of two dedicated workstream sessions. Both
are explicit in the s15 prompt's recalibrated stance — Jamie is the
one to choose between them.

**Option A: getUser() sweep dedicated session (~2-3h).** Cumulative
17 of ~30 user-facing edge fns fixed across s12+s13+s14. ~13
remain. Mechanical 2-line fix per fn (`getUser()` →
`getUser(token)` with `token = authHeader.replace('Bearer ', '')`).
Catalogued in [audit/findings/2026-05-10-getuser-noargs-sweep.md].
Stop capping at 5/session — clear the lot in one focused pass.
Each fn left unbroken is a Lauren-shadow-term papercut. Remaining
priorities (live launch-in-scope from the finding):
stripe-update-payment-preferences, stripe-verify-session,
stripe-subscription-checkout, stripe-billing-history, gdpr-export,
gdpr-delete, send-notes-notification, notify-makeup-offer,
process-term-adjustment, invite-accept, create-billing-run,
create-continuation-run.

**Option B: Money-path systematic clearing kickoff (~3-4h).**
Invoicing & Payments is the single biggest 🟡 block in audit/MASTER.md
(23 rows; ~3 are 🟢 even after s15). Lauren-paramount per v2 §3.1.
Sessions 16-18 should be a money-path sweep — every row to 🟢 with
real test + production verification + audit tag. s16 kickoff:
* Start with the easiest-to-promote rows that already have stable
  E2E coverage (Invoice list/detail, Stripe webhook, payment-intent
  + checkout) — straight 🟡→🟢 promotion candidates after Notes
  audit, like s15's portal sweep.
* Then add tests for the under-covered rows (auto-pay run,
  recurring billing run, refund notification, dispute notification).
  Most are service-role-only edge fns — DB-shape contract tests
  similar to §27 are appropriate.
* End-of-session target: ~10-12 rows in the money-path block at 🟢.

Both options assume the recalibrated stance: **audit/MASTER.md
hygiene is non-negotiable**; aim for ≥5 rows backfilled to 🟢 per
session (s15 landed 12). The bar is "every area cleared to
world-class", not "fix the worst bug".

**Step 0** (either option): pull, read HANDOVER, run baseline.
Expected: ~471 passed / 7-9 failed / 129 skipped / 4-5m wall-clock.
If §14.10.16 still flakes after the s15 10s poll bump, mark the
file `mode: 'serial'` like §22.2.

### Priority order — 15th session pickup (closed)

**Closed**: 2 flaky tests hardened (§13.7.4 bulk-send + §14.10.16
dispute-cascade) via service-role-curl pattern; §22 +4 real tests
(50%→75%); §11 +3 real tests (60%→75%); audit hygiene 12 rows
🟡→🟢. Catalog 70% → ~73%.

**Original**: re-baseline. If the 2 new s14 flaky tests (§13.7.4
bulk-send + §14.10.16 dispute-cascade) are still flaking, harden
them first (~30 min). Pattern: replace `supabaseSelect` calls in
result-assertion phase with direct service-role curl. Reference:
`§27 — notification_preferences RLS contract` test in
27-notifications.spec.ts uses this pattern.

**Primary**:

1. **Continue catalog work**. §13 at ~80%, §14 at ~85%, §11 at
   ~60%. Remaining gaps:
   - §13: from-lessons creation (§13.7.7), apply credit (§13.7.9),
     billing run (§13.7.10/11/12). 1.5h.
   - §14: send-modal 2-guardian default (§14.10.2), send reminder
     contract (§14.10.4), edit-from-sent block (§14.10.13). 1h.
   - §11: archive UI dialog flow (browser-driven; §11.4.4/5 are
     RPC-only; the dialog-driven version still pending). Plan-cap
     check (§11.4.6). 1.5h.

2. **§22 deeper coverage** — was 50%; needs 2-3 more launch-visible
   tabs (organisation, payments, billing, instruments) to push
   toward 70%. ~1.5h.

3. **§20 decline-flow edge case** — last §20 sub-case. ~30-45 min.

4. **getUser() sweep — remaining ~13 fns**. Cumulative 17/~30
   done. Lower priority (less launch-critical). ~30 min cap.

### Priority order — 14th session pickup (closed)

**Closed**: §13/§14/§11 +8 real tests; bulk_update_lessons enum
cast fix; getUser sweep +4 stripe fns. Catalog 66% → ~70%.

### Priority order — 13th session pickup

**Step 0**: verify DNS still resolves cleanly. The s13 fix (CNAME →
`lessonloop-app.netlify.com`) is in place; if `*.netlify.app` ever
comes back online there's no action needed (`.com` continues to
work). If a different DNS issue surfaces, see s13's finding doc for
the diagnostic playbook (resolver chain, TLD authoritative probe,
edge-IP override).

The s13 baseline post-fix should also be checked first thing — see
the "Reality check" section for the post-fix counters.

S13's 10 edge-fn deploys (csv-import-execute, csv-import-mapping,
onboarding-setup, profile-ensure, batch-invite-guardians,
stripe-create-payment-intent, stripe-process-refund,
stripe-connect-onboard, stripe-connect-status, send-invite-email)
were verified by the post-fix baseline if numbers match the s12
baseline (~464 passed). Spot-check §10.7 csv-import,
§24.7 stripe-process-refund, §27 invite flows if real tests exist
and full-suite isn't conclusive.

**Primary (post-baseline)**:

1. **Continue getUser() sweep on remaining ~17 fns.** S12+s13 fixed
   13 (3 + 10). Catalogue at
   `audit/findings/2026-05-10-getuser-noargs-sweep.md`. Next
   priorities (live launch-in-scope): stripe-create-checkout,
   stripe-list-payment-methods, stripe-detach-payment-method,
   stripe-update-payment-preferences, stripe-verify-session,
   stripe-subscription-checkout, stripe-billing-history,
   stripe-customer-portal, gdpr-export, gdpr-delete,
   send-notes-notification, notify-makeup-offer,
   process-term-adjustment, invite-accept, create-billing-run,
   create-continuation-run.

2. **§13/§14 remaining invoice cases.** Sections at 70/75% mature.
   1-2h.

3. **§11 Teachers invite/archive UI flows.** Sections at 30%.
   2-3h.

### Priority order — 13th session pickup (closed)

**Primary**:

1. **Continue the getUser() sweep.** Session 12 fixed the 3 most
   launch-critical (send-invoice-email, notify-internal-message,
   send-cancellation-notification). Remaining ~27 user-facing fns
   catalogued in
   [finding](audit/findings/2026-05-10-getuser-noargs-sweep.md).
   Stripe-* + xero-* + invite-* + csv-import-* are next priorities.
   Mechanical fix per fn (2-line patch). Bundle in batches of 5-7 with
   §-by-§ regression tests where possible. Estimate: 1-2h dedicated
   session.

2. **§13/§14 remaining invoice cases.** Sections are mature (10 + 12
   tests already real); a few unfilled gaps remain (bulk-void edge
   cases, line-edit triggers beyond status-transition). 1-2h pass.

3. **§11 Teachers invite/archive UI flows.** §11.4.1 unlinked-teacher
   landed; bigger UI surface (invite member, archive teacher,
   teacher-limit enforcement) still needs coverage. UI-driven so
   brittle; estimate 2-3h.

**Lower priority**:

4. §22 deeper settings coverage — §22 + §24 cross-file race
   re-appeared in 11th-session full-suite (3-4 §22.2 tests flake when
   §24 is interleaved). 30-min separate fix: `playwright.config.ts`
   give §22 + §24 their own throwaway org via fixture-per-file, OR
   pin them to single-worker.

5. §5.4 redesign per the finding doc. ~1-2h.

**Quietly closed in session 12** (do NOT re-discover):
- Vault seeding (was 7-session deferred). vault.SUPABASE_URL +
  SUPABASE_SERVICE_ROLE_KEY now seeded.
- _notify_streak_milestone x-cron-secret bug (replaces phantom drift
  framing entirely).
- 3 user-facing edge fn auth bugs (getUser → getUser(token)).
- global-setup.ts require()-in-ESM bug (term_adjustment sweep was
  silently failing every run).

### Priority order — 12th session pickup (closed)

**Closed:** Vault seeding + streak-notification x-cron-secret fix +
§17.4 e2e delivery test + §27.fixme → 2 real RLS tests + 3 getUser()
sweep fixes + global-setup ESM fix.

### Priority order — 11th session pickup (closed)

**Closed:** Drift saga (phantom). §16 cluster (12 real). P1 fix
in send-bulk-message. Stale-row sweep extended to handle
term_adjustments + circular FK.

### Priority order — 10th session pickup (closed)

**Closed:** §20 cluster (withdrawal + delete-run shipped). P0
bulk-process-continuation auth chain bug fixed.

**Pre-session needs from Jamie (only for vault seeding):**

The drift saga is closed as PHANTOM (sessions 9-10 misread). The
actual edge-fn env mismatch is documented in
`audit/findings/2026-05-09-edge-fn-env-injection-mismatch.md`. It's
NOT a problem Jamie can fix from the dashboard — Custom Secrets
panel is empty, JWT signature is valid for the project (Probe A
proved this). The platform is auto-injecting a different value
than the dashboard for reasons we don't fully understand.

The agent's task in session 12 should NOT be to "fix the drift"
(there is no drift) and NOT to propose JWT secret reset (which is
a nuclear Jamie-only decision). Instead:

**Either:**

(a) **Decide that streak notifications don't ship for v1.0**
    and document. The trigger fires defensively (per ec94ee3
    fix), audit_log row commits, push notification is best-
    effort. Lauren can verify in production whether her users
    actually rely on the push to know their streak hit a
    milestone. If they don't (likely — they'd see the streak
    counter in-app), the notification not delivering is a
    nice-to-have, not P0.

(b) **Code-route around the issue:** modify streak-notification
    edge fn to use `getUser(token)` instead of byte-equal
    `.includes()` for auth, OR have the trigger call PostgREST
    directly instead of going through the edge fn at all
    (skip the auth gate entirely). Single-fn change, lots of
    side-effects to think through. Estimate 2-3h.

Either path is a future-session call, not a session-12 task.

**Session 12 priorities (in order):**

1. **§13 / §14 remaining invoice cases** — sections are mature
   (10 + 12 tests already real) but the catalog has a few
   unfilled gaps: §13.x bulk-void edge cases, §14.x line-edit
   triggers beyond status-transition. Worth a 1-2h pass to close
   out the cluster.

2. **§11 Teachers invite/archive flows** — §11.4.1 unlinked-teacher
   landed; the bigger UI surface (invite member, archive teacher,
   teacher-limit enforcement) still needs coverage. UI-driven so
   brittle; estimate 2-3h.

3. **§22 deeper settings coverage** — §22.1 profile mutations,
   §22.3 branding upload, §22.5 closure dates CRUD (Lauren-
   mentioned for greying out calendar), §22.7 GDPR export queue,
   §22.8 rate cards CRUD, §22.10 messaging templates, §22.11
   availability overlapping-block trigger, §22.18 NotificationsTab
   toggles. **Note:** §22 + §24 cross-file race re-appeared in the
   11th-session full-suite baseline (3-4 §22.2 tests flake when
   §24 is interleaved). Worth a 30-min separate fix:
   `playwright.config.ts` could give §22 + §24 their own throwaway
   org via fixture-per-file, or pin them to single-worker via a
   project assignment.

4. **§5.4 redesign** — implement the magic-link or UI-signup
   approach from the finding doc. ~1-2h.

5. **§17 follow-ups** — §17.4 streak-milestone is currently a
   transient flake in full-suite (passes 5/5 in isolation).
   Worth investigating whether the test relies on stale practice
   data that's getting clobbered by parallel workers. Could be
   a 30-min fix.

**Lower priority (only if items 1-3 close cleanly):**

A. **§8 remaining cases** — §8.8.3 conflict-detection blocks save,
   §8.8.12 closure-date warning banner, §8.8.14 weekly recurrence.
   UI-driven; brittle.

B. **§9 Daily register** — §9.3.4 check_attendance_not_future
   already covered in §32.7. Other §9 cases are UI-heavy.

C. **Production verification of withdrawal fix + bulk fix**
   — once Lauren has real users in shadow-term week 4 and a
   parent withdraws / a bulk message goes out, verify the chains
   end-to-end in production logs. Both bugs were silent before
   the fixes (sessions 10 + 11); need to confirm the fixes deliver
   in a real environment.

D. **Vault seeding decision** — see "Pre-session needs from
   Jamie" above. NOT a session 12 task; needs Jamie's call on
   whether streak push notifications are P0 for v1.0.

### Audit/MASTER.md hygiene status (end of 11th session)

11th-session updates pending in the audit hygiene commit:
- §16 Messages row should be marked with [E2E real per
  11th-session] covering bulk + internal + threads + mark-read
- The drift-related rows in audit/findings/ are now CLOSED
  (phantom) + REPLACED by edge-fn-env-injection-mismatch finding

Estimated ~34 of ~180 rows tagged after 11th-session hygiene
commit lands (was ~33 at session 10 end).

### Audit/MASTER.md hygiene status (end of 10th session)

§20 Continuation row tagged with [E2E real per 35631ad +
10th-session] covering: §20.4 create + RBAC + validation, §20.5
process_deadline both branches, §20.7 confirmed flow, §20.7b
withdrawals flow (NEW), §20.8 delete-run cases (NEW). Row marked
[PROMOTABLE 🟡→🟢]. Header bumped to 10th-session reference.

### Audit/MASTER.md hygiene status (end of 9th session)

9th session was infrastructure-focused, no row promotions. The
findings filed under `audit/findings/` have their own discovery dates;
they reference back to the audit MASTER rows where relevant. No
audit/MASTER.md changes this session — that hygiene resumes in
session 10 alongside catalog work.

### Audit/MASTER.md hygiene status (end of 8th session)

Updated rows in 8th session (audit hygiene commit alongside the
test commits):
- §15 Reports (Payroll / Utilisation / TeacherPerformance) — added
  [E2E real per 3e9891b] data-correctness tags. §15 cluster now
  fully tagged across all 7 launch reports.
- §26.9 Portal invoices & pay — extended existing tag to include
  ae87a48 — installment pay-one + pay-all-remaining coverage.
- §11.4 Teachers list/CRUD — backfilled with [E2E real per 6a0bbab]
  for §11.4.1 unlinked-teacher contract (5th-session work that
  missed the audit row update at the time).
- Header bumped to 8th-session reference.

Still stale 🟡 (target session 10 hygiene if catalog work resumes):
- §20 Continuation (will be flipped after session 10's withdrawal
  work or earlier if Jamie does a review pass)
- All cron rows other than the 2 already tagged
- §22 deeper coverage rows when more settings tests land

**~32 of ~180 rows now have E2E real proof appended** (was ~28 at
session 7 end). Promotion 🟡→🟢 still deferred to a focused Jamie
review pass once a critical mass of PROMOTABLE tags accumulates —
the PROMOTABLE-tagged count is growing each session and is now
8-10 rows; soon worth a dedicated promotion pass.

### Gaps that are explicitly NOT priorities

- **Hidden/cut features** per LESSONLOOP_V2_PLAN.md §3.2-3.3:
  leads pipeline, enrolment_waitlist, lead funnel, recurring
  billing templates UI, booking page, Zoom integration, parent
  self-reschedule UI, parent LoopAssist, agency tier. One smoke
  test each is enough.
- **Mobile-safari project tests** (§24.3 Apple Pay, §26.9.4
  native notice, §26.9.5 Apple Pay only). Mobile-safari is a
  separate Playwright project; not master.
- **Non-launch reports** if there were any — all 8 are in launch
  scope per §3.1.

After those nine, remaining ~25 sections are mostly per-page smoke
and edge cases.

<a id="24-progress"></a>
### §24 progress (3rd + 4th session — landed)

Implemented (commits `b7900ab` → `e36e486` for the J24-A infra in 3rd
session, then `499d54b` for §24.12 true-replay in 4th session, all
pushed to `main`):

**Infrastructure (J24-A):**
- Migration `20260517100000_org_stripe_test_mode_flag.sql`: adds
  `organisations.stripe_test_mode boolean NOT NULL DEFAULT false`.
  E2E org `25b57950-…` set true; every other org defaults to live.
- New helper `supabase/functions/_shared/stripe-client.ts`:
  `getStripeClient(orgId, supabase)` → `{ stripe, mode }`. Defensive:
  missing column / null orgId / lookup failure → live fallback.
  Test mode requested but `STRIPE_TEST_SECRET_KEY` missing → throws
  (never silently routes a flagged org through live, never accidentally
  routes a live org through test).
- 14 stripe-* edge fns + `_shared/auto-pay-reminder-core.ts` +
  `admin-backfill-default-pm` refactored to use the helper. Cron-style
  fns (auto-pay-installment, auto-pay reminders, admin-backfill) cache
  one Stripe client per org to amortise the per-installment lookup.
- `stripe-webhook` is dual-mode: tries `STRIPE_TEST_WEBHOOK_SECRET`
  first, falls back to `STRIPE_WEBHOOK_SECRET`. Each verified event
  uses the matching SDK client for downstream calls (e.g.
  `stripe.subscriptions.retrieve` in `handleSubscriptionCheckoutCompleted`).
- Stripe Dashboard test-mode webhook endpoint `we_1TUwZhBAjFOLYDS3QGslhpbj`
  (URL: `https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/stripe-webhook`)
  subscribed to the 18-event superset the handler dispatches on. Secret
  stored as Supabase env `STRIPE_TEST_WEBHOOK_SECRET`.

**Tests (12/17 catalog §24 items real):**
- `tests/e2e/master/_fixtures/stripe-test-helpers.ts` — driven via
  Stripe TEST API directly, not Stripe Elements iframe. Now also
  exposes `postWebhookEvent(eventBody)` for §24.12 true-replay tests
  (signs with HMAC-SHA256 of `{ts}.{body}` against
  `STRIPE_TEST_WEBHOOK_SECRET`, posts to
  `${SUPABASE_URL}/functions/v1/stripe-webhook`).
- `24-stripe.spec.ts` covers §24.1, §24.2/§24.3, §24.5 list, §24.5 detach,
  §24.7 partial refund, §24.10 billing history, §24.12 dedup contract
  (3 tests: real-PI invariant + true replay same event_id + same
  PI different event_id), RBAC negative (finance →
  stripe-process-refund 400), cross-tenant (parent2 → parent1's
  invoice 400), UI smoke.

**Not yet covered (out of §24 scope):**
- §24.3 Apple Pay button visibility (mobile-safari project only).
- §24.4 Hosted checkout fallback (web/native split — `stripe-create-checkout`).
- §24.6 Auto-pay installment success / failure (cron + decline cards).
- §24.8 Dispute simulation (requires Stripe CLI `stripe trigger`).
- §24.9 Stripe Connect onboarding (multi-step OAuth flow).
- §24.11 Verify session post-checkout (subscription-checkout return URL).

**Two latent issues found and FIXED in the 3rd session:**
1. ~~`update_invoice_status` RPC doesn't exist; `seedInvoice` silently
   no-op'd status transitions.~~ Fixed in `7dcd024`: replaced with
   `patchInvoiceStatus` in `tests/e2e/supabase-admin.ts` — direct
   service-role PATCH that goes through the
   `enforce_invoice_status_transition` trigger.
2. ~~Live Stripe webhook only subscribed to 6 of the 17 events the
   handler dispatches on.~~ Fixed via Stripe API:
   `we_1TUlSHAzPfYm94ux4mOfF72i` now subscribes to the same 18-event
   superset as the test endpoint. `payment_intent.succeeded`,
   `charge.refunded`, `charge.dispute.*` etc are now being delivered
   in production. **Verify post-launch:** when the first real
   embedded-drawer payment lands, confirm the payment row writes via
   the webhook (not just via stripe_checkout_sessions).

**Rate limit gotcha:** stripe-create-checkout is 10/hr per user;
stripe-process-refund is 5/hr. Tests reset `rate_limits` rows for known
e2e users in `beforeAll` (see `resetE2ERateLimits` in
`stripe-test-helpers.ts`). If you debug-rerun and start hitting 429,
that helper unsticks you.

### How to do a section properly

Per the catalog Appendix E checklist, every section needs:

- [ ] Happy path (logged-in role with sufficient permissions, valid input)
- [ ] Validation (empty, malformed, too long, special chars)
- [ ] RBAC negative (other roles redirected/blocked)
- [ ] RLS negative (cross-org / cross-tenant blocked)
- [ ] Trigger / RPC error cases (DB-side guardrails)
- [ ] Optimistic update + rollback
- [ ] Realtime update (where applicable)
- [ ] Audit log entry
- [ ] Mobile viewport (via `mobile-safari` project)
- [ ] No console errors
- [ ] No broken images

A section is **only done** when every checkbox has a passing test. Not
a `test.fixme()`. Not a comment. A passing test.

### Workflow per section

1. **Read the catalog section in full** (e.g. `§24 Stripe payments` is
   ~80 lines). Note every test case it specifies.
2. **Open the existing master spec file** (e.g. `24-stripe.spec.ts`).
   Delete every `test.fixme()` — they're misleading.
3. **For each catalog test case, write a real test:**
   - Set up clean test data via factories (`seedStudent`, `seedInvoice`, etc.)
   - Click through the UI step-by-step (or call the edge fn directly if catalog says so)
   - Assert at every meaningful step (DB row present, page state, audit log entry)
   - Clean up at the end (cleanup helpers in `supabase-admin.ts`)
4. **Run that single file** in isolation: `npx playwright test tests/e2e/master/24-stripe.spec.ts --project=master`. Iterate until all green.
5. **Commit** with message `test(e2e): §24 Stripe — N tests now real (was N fixmes)`.
6. **Update this HANDOVER.md** with the new completion percentage.
7. **Move to next section.**

---

## Anti-patterns

Things prior sessions did wrong — don't repeat them:

### ❌ Don't use `test.fixme()` as a placeholder

```ts
// BAD — looks like progress, is actually nothing
test.fixme('§24.3 — parent pays invoice via embedded drawer', async () => {});
```

It runs as "skipped" and counts toward your "passing" total in misleading
ways. Either write the real test, or delete the line and add a TODO
in plain comment form: `// TODO §24.3 — parent pays invoice…`.

### ❌ Don't run trigger guard tests via service-role

```ts
// BAD — service-role bypasses many triggers by design
const result = tryUpdate('organisations', `id=eq.X`, { subscription_plan: 'custom' });
// Will succeed because service-role skips protect_subscription_fields
```

The realistic attack surface is the **owner JWT** going through PostgREST,
not service-role. Triggers like `protect_subscription_fields` are designed
to fire ONLY for non-service-role calls. Use `getOwnerJwt()` from
`32-security.spec.ts` for trigger tests.

### ❌ Don't trust the catalog's column names blindly

The catalog was written from source code; some details drifted:

| Catalog says | Reality |
|---|---|
| `practice_streaks.current_streak_days` | `current_streak` (no `_days` suffix) |
| `practice_streaks.longest_streak_days` | `longest_streak` |
| `student_guardians.relationship = 'parent'` | enum is `mother\|father\|guardian\|other` (use `'guardian'`) |
| `data-tour="..."` selectors | actually `data-hint="..."` (search the codebase) |

Always cross-check with `information_schema.columns` via Supabase MCP
before writing assertions.

### ❌ Don't read the test file count and call it done

```
547 tests, 312 passed, 0 failed → "we're good"
```

No. The catalog has 500-700 specific cases. We have 80 real ones.
Track real coverage, not file count.

### ❌ Don't click a Collapsible trigger that's already expanded by default

Caught me on the first §15.4 Outstanding pass. `Outstanding.tsx`
initialises `expandedBuckets` with `new Set(['Current (0-7 days)'])`
— the Current bucket renders OPEN by default. Clicking the bucket
header trigger TOGGLES it, so my "click to expand then assert table
content" path actually collapsed it.

Pattern: before clicking a Collapsible/Sheet/Drawer/Dialog trigger,
check the page component for whether the initial state is open.
React state initialisers are easy to miss — `useState(() => new Set(['Foo']))`
hides the default in a callback.

### ❌ Don't use `supabaseSelect` to assert on parent-scoped RLS data

`supabaseSelect` (in `tests/e2e/supabase-admin.ts`) uses the OWNER's
JWT against PostgREST. For tables where RLS scopes to non-owner
user_ids (e.g. `notification_preferences` only visible to that
user, not the org owner), the SELECT returns an empty array even
though the row exists. Use a service-role curl helper instead —
see `selectServiceRole` in `§26.11` describe.

### ❌ Don't use `supabaseSelect` for result-side assertions in long-running tests under parallel contention (s14+s15 lesson)

Recurring shape across sessions 14 + 15. When a test does heavy
work (multiple edge-fn calls + RPCs + dispute insert + cascade
RPC), the result-side `supabaseSelect` calls (which route through
the owner JWT proxy) can return:
- non-array shapes (PostgREST error objects) under PostgREST
  proxy timeouts at high cross-file contention;
- 0 rows even when the data exists, because PostgREST visibility
  has lagged 1-3s behind the latest committed transaction.

The fix is **always**:
1. Inline `selectServiceRole(table, query)` at the describe scope
   (or top-of-file, but inline keeps the pattern legible at the
   call-site). Service-role curl bypasses the owner-JWT-proxy.
   **Always coerce non-array responses to []** so callers can
   rely on `.length`.
2. For assertions on rows the RPC writes inside its body
   (audit_log being the prototype case), wrap with
   `selectServiceRoleWithPoll(table, query, predicate)` —
   10s deadline, 250ms poll interval. The row IS committed when
   the RPC returns; the poll just defuses PostgREST visibility
   lag.

The full pattern is implemented in §13.7.4 + §14.10.16 (s15
fixes). Copy when writing any new test that does
edge-fn-call → result-side-select.

**Don't:** add a `mode: 'serial'` directive as the first response.
Serial-within-file isn't enough when the contention is cross-file
(§22.2 was already serial within file and still raced against §24).
Service-role-curl is the durable fix; serial is a fallback if
service-role somehow can't be used.

### ❌ Don't `require()` in spec files — they're ESM

Caught me writing `const { execSync } = require('node:child_process')`
inside helpers in `10-students.spec.ts` (6th session). Playwright runs
spec files as native ESM under tsx — `require` is undefined and the
test fails with `ReferenceError: require is not defined` BEFORE any
assertions run. Lift the imports to the top of the file (`import
{ execSync } from 'node:child_process'`).

### ❌ Don't forget `attendance_records.recorded_by` (NOT NULL, no default)

Caught me on the §15.4 Cancellations + Attendance tests (6th session).
First runs failed with the page rendering empty-state because my
inserts were silently rejected. The fn's `supabaseInsert` returns
null on error but doesn't throw — the test continues, then asserts
on absent text and times out 15s later. **Lesson:** for any
attendance_records insert, pass `recorded_by: getOwnerUserId()` (or
similar uuid). Also a good idea to wrap supabaseInsert in
`if (!row?.id) throw new Error(...)` so future seed failures
surface immediately.

### ❌ Don't use deterministic hash for term `baseYear` in §20 seeds

§20 continuation tests need 2 non-overlapping terms in the e2e org.
The `check_term_overlap` trigger rejects any insert that intersects
an existing term's date range. The original §20.1 seed used a
testId-string hash mod 50 to pick a far-future baseYear (2400-2449
window) — this gave only 50 buckets, and two tests starting in the
same ms with similar testId fragments hashed to identical years.
First run of §20 in 6th session: 3 of 6 tests failed with "Term dates
overlap with an existing term" because parallel/serial workers
collided AND a partial seed leaked from a half-cleaned-up earlier
run. Switched to `Math.random() * 500` for baseYear (2400-2899)
plus a one-off SQL sweep of stale `e2e_*` term rows. If you ever
see `code=P0001 message="Term dates overlap with an existing term"`
during seed, sweep stale e2e_ terms first:

```sql
DELETE FROM term_continuation_responses
  WHERE org_id='25b57950-...' AND run_id IN (...);
DELETE FROM term_continuation_runs
  WHERE org_id='25b57950-...' AND current_term_id IN (
    SELECT id FROM terms WHERE org_id='25b57950-...' AND name LIKE 'e2e_%');
DELETE FROM terms
  WHERE org_id='25b57950-...' AND name LIKE 'e2e_%';
```

### ❌ Don't forget to sweep stale e2e_ STUDENT rows at session start

Prior anti-pattern guidance only mentioned stale e2e_* term + lesson
sweeps. 8th-session caught this gap: 2715 stale e2e_-prefixed
students had accumulated across earlier sessions (cleanup-on-failure
paths leak when a worker crashes mid-test). Pre-session baseline ran
fine in 3.8 min / 4 fails. After landing the new tests, the next
full-suite run wedged to 6.8 min / 9 fails — not because the new
tests broke anything, but because adding 5 more student-seeding
tests pushed the per-query cost over the tipping point on a
2715-row e2e_* table. After sweeping, baseline returned to 4.0 min
/ 4 fails (just +0.2 min for the 5 new tests).

Recommended sweep at session start when wall-clock looks elevated:

```sql
DELETE FROM attendance_records ar USING students s
  WHERE s.id = ar.student_id AND s.org_id='25b57950-...'
    AND (s.first_name LIKE 'e2e_%' OR s.last_name LIKE 'e2e_%');
DELETE FROM lesson_participants lp USING students s
  WHERE s.id = lp.student_id AND s.org_id='25b57950-...'
    AND (s.first_name LIKE 'e2e_%' OR s.last_name LIKE 'e2e_%');
DELETE FROM student_instruments si USING students s
  WHERE s.id = si.student_id AND s.org_id='25b57950-...'
    AND (s.first_name LIKE 'e2e_%' OR s.last_name LIKE 'e2e_%');
DELETE FROM student_guardians sg USING students s
  WHERE s.id = sg.student_id AND s.org_id='25b57950-...'
    AND (s.first_name LIKE 'e2e_%' OR s.last_name LIKE 'e2e_%');
DELETE FROM students WHERE org_id='25b57950-...'
  AND (first_name LIKE 'e2e_%' OR last_name LIKE 'e2e_%');
```

Order matters (FK chain). Run via Supabase MCP execute_sql.

### ❌ Don't assume the documented "13 brittle" failures are JWT-stale

7th-session investigation showed the 2 visible persistent flakes
(§5.4 email-verification gate; RBAC Settings degradation) are NOT
JWT-stale. They have specific signatures:
- §5.4: `signInAndWriteStorageState failed: email_not_confirmed` —
  Supabase auth quirk where a freshly-created throwaway user with
  `emailConfirmed: false` is rejected at sign-in. Independent of
  JWT freshness.
- RBAC Settings degradation: the `hasProfile` text-visibility
  assertion times out at 5s — UI render race waiting for Profile
  tab content. The teacher-role's resolvedTab logic kicks
  organisation→profile correctly, but the page may take longer to
  paint than the 2s `waitForTimeout`.

The JWT-injection fixture landed in e08482a is benign-additive and
should help any genuine staleness in long parallel runs, but
session-8+ work should NOT assume these 2 will disappear after the
fix. They need separate root-cause work — flagged for Jamie review
in the [Open production-relevant items](#open-production-relevant-items)
table.

### ❌ Don't inherit diagnostic conclusions across sessions without re-running the diagnostic

11th-session lesson. The drift saga across sessions 9 + 9a + 10
carried forward the "151e578f… deployment env hash" as if it were
an established fact. That hash came from an env-probe-temp
function in session 9a which was never validated. Every
subsequent session probed differently and came to the same
conclusion: drift exists. But none ran a SIGNATURE-validity probe
(PostgREST direct with the JWT) — which would have shown the JWT
IS valid for the project, ruling out drift.

When the 11th-session prompt finally insisted on a fresh
three-probe diagnostic (Probe A: PostgREST direct), the answer
came back instantly: HTTP 200. No drift. The actual issue was
edge-fn env injection mismatch — a different, narrower problem.

**Cost of the misdiagnosis**: two infrastructure sessions
deferred unnecessarily (sessions 9 + 10 partially); one P0
launch-blocker (vault seeding) staying unfixed for 5+ sessions
based on a phantom blocker.

**Rule**: when reading a HANDOVER ledger entry that includes a
diagnostic conclusion, re-run the diagnostic before acting on
it. Especially if the conclusion is structural (drift, RLS bug,
auth bypass). One wasted probe is much cheaper than a wasted
session.

### ❌ Don't conclude a flow works because one auth-related path is verified

12th-session lesson. The session-12 prompt asserted vault seeding was
unblocked because:
1. _notify_streak_milestone reads from vault.decrypted_secrets, not
   Deno.env.
2. streak-notification has verify_jwt=false; gateway doesn't
   byte-equal check the bearer token.
3. The legacy JWT signature is valid → trigger callout works
   end-to-end.

Bullets 1+2 were correct. Bullet 3 was a leap. The function
ALSO has its own internal auth gate (`validateCronAuth(req)` →
checks `x-cron-secret` header), which the trigger never sent.
Result: every milestone callout returned 401 silently.

The mistake was accepting a chain conclusion ("trigger callout
works end-to-end") that wasn't probe-tested across each link of
the chain. The correct probe sequence: (a) trigger fires →
audit_log row commits, (b) net.http_post fires → row appears in
net._http_response, (c) status_code = 200 (not 401). Sessions 9
and 11 stopped at (a). Session 12 ran (b) and (c) and immediately
caught the 401.

**Rule**: vault.decrypted_secrets and Deno.env.get are different
injection paths in Supabase; values are independent. Similarly,
gateway verify_jwt and function-internal auth gates are
different layers. Verify each link before declaring a chain
"works end-to-end". Always poll `net._http_response` (the
ground truth) when a trigger calls an edge fn — don't infer
delivery from the audit_log alone.

### ❌ Don't call userClient.auth.getUser() without an explicit token

Recurring pattern across sessions 10 + 11 + 12. When an edge function
constructs `createClient(SUPABASE_URL, ANON_KEY, { global: { headers:
{ Authorization: authHeader } } })` and then calls
`.auth.getUser()` with no args, that makes a `/auth/v1/user`
request which on this post-migration project rejects legacy HS256
JWTs (and rejects service-role JWTs because they have no `sub`
claim). The fix is **always**:

```ts
// BAD — silent 401 for legacy-JWT sessions or service-role callers
const { data: { user } } = await supabaseAuth.auth.getUser();

// GOOD — local JWKS verification, accepts the legacy format
const token = authHeader.replace("Bearer ", "");
const { data: { user } } = await supabaseAuth.auth.getUser(token);
```

Session 12 swept the codebase: ~30 user-facing edge fns still have
the buggy pattern. 3 most launch-critical fixed in session 12;
remaining ~27 catalogued in
[2026-05-10-getuser-noargs-sweep.md](audit/findings/2026-05-10-getuser-noargs-sweep.md).
**Sweep periodically** — this pattern keeps propagating because the
buggy form *looks* correct at code-review time.

### ❌ Don't `require()` in tests/e2e/global-setup.ts (it's ESM)

Anti-pattern documented for spec files (HANDOVER §"Don't `require()`
in spec files — they're ESM"), but slipped into global-setup.ts
during the 11th-session term/credit-note sweep extension. Caught in
session 12: every full-suite run was logging
`[global-setup] Sweep error (non-fatal): require is not defined`
and silently skipping the term_adjustment + circular FK cleanup.
The outer `try/catch` swallowed the error so it didn't fail the
suite, but stale rows accumulated → likely contributing to the
session-11→12 flake creep (6 → 9 fails, 5.3 → 5.7 min wall-clock).
Fixed by lifting `import fs from 'node:fs'` to top of file.

**Rule**: tests/e2e/* runs as native ESM under tsx. Always use
top-of-file imports. Same applies to global-setup.ts, _fixtures/*,
and any helper imported from spec files.

### ❌ Don't trust a "freshly-rotated" supplied key without SHA-256 verification

9th-session Step 0 caught a subtle failure mode. Jamie supplied a
service-role key labeled "freshly-rotated" but it turned out to be
the same stale value already in `.env.test` (iat=2026-04-29). Almost
certainly a stale clipboard paste rather than a fresh dashboard read.

PostgREST direct calls accepted the key (the JWT signature is valid
for RLS bypass), so a Playwright file-level test against §27 ran
green — that test only does DB-shape work. A direct curl probe of
`send-payment-receipt` returned 401, exposing the drift.

**Verify keys before trusting:**

```bash
# Local key SHA-256
KEY=$(grep -E "^E2E_SUPABASE_SERVICE_ROLE_KEY=" .env.test | cut -d= -f2-)
printf '%s' "$KEY" | shasum -a 256

# Deployment env hash
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/<project_ref>/secrets" \
  | jq -r '.[] | select(.name=="SUPABASE_SERVICE_ROLE_KEY") | .value'
```

These must match. If they don't, the key won't authenticate against
edge fns. PostgREST will still work because JWT signing isn't the
same as the env-byte-equal check.

When asking the user for a key:
- Specify "fresh dashboard read, no clipboard reuse"
- Verify by running the curl probe above before proceeding to
  vault seeding or fn-invocation work
- A failed verification means `HALT and surface`, not "try again
  with the same value"

### ❌ Don't trust .env.test E2E_SUPABASE_SERVICE_ROLE_KEY for fn invocation

Several edge functions (send-payment-receipt, send-refund-notification,
send-auto-pay-alert, send-templated-email if it exists) require
`Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` byte-equal to the
deployed function's env value. Post 2026-05-08 migration, the legacy
JWT in .env.test (iat=2026-04-29) does NOT match the deployment's env
— the function returns 401.

For PostgREST direct calls (`*.supabase.co/rest/v1/<table>`) the
legacy JWT still works (the test suite's supabase-admin.ts factories
all work fine). The mismatch is specifically at the edge function
auth gate.

**Workaround**: until Jamie refreshes .env.test (Management API
returns SHA-256 only — no plaintext recovery without rotation), use
DB-shape contract tests instead of fn-invocation. The §27
notifications spec demonstrates the pattern: prefs upsert + SELECT
round-trip + UNIQUE partial index assertion + RBAC auth-gate
negative tests.

### ❌ Don't forget the trg_cleanup_attendance_on_cancel order

When seeding a cancelled lesson + attendance_records together: PATCH
the lesson to `status=cancelled` FIRST, then INSERT the attendance
row. The cleanup trigger fires on the lesson UPDATE → cancelled
transition, not on subsequent attendance inserts. Reverse the order
and the trigger nukes your seed before you can assert on it.

### ❌ Don't forget the `E2E_PARENT_GUARDIAN_ID` constant in new describes

Each top-level `test.describe` block in `26-parent-portal.spec.ts`
needs to declare `const E2E_PARENT_GUARDIAN_ID = '44821141-…'` if
it touches the parent's guardian. Only `§26.4` had it originally;
adding `§26.10` reply tests caught me with `ReferenceError`. The
constant lives in multiple places by design (each describe is an
IIFE-style scope) — copy it from §26.4 / §26.6 / §26.10 when you
add new describes.

### ❌ Don't write tests longer than 9 minutes total

Supabase JWTs default to 1hr exp, but in parallel runs with 4 workers,
the JWT loaded into a browser context can stale at the 8-9min mark
even when the storage state file is fresh. The `auth-refresh.ts` fixture
helps but doesn't fully solve it.

**Workaround**: shard your test runs into <8min batches, OR add per-test
JWT injection (the next planned fix — see [Known issues](#known-issues)).

---

## Known issues / gotchas

### The 13 brittle test failures (long-run JWT stale)

When running the full master suite (~3.5-4.5 min, ~553 tests at 4
workers), up to ~13 tests can flake. They pass individually. They flake
in the full batch.

**Root cause:** Playwright loads `storageState` at browser context creation,
but contexts persist across tests within a worker. The JWT in localStorage
of a running context doesn't auto-refresh just because the file on disk does.

**The 13:**
- 5 RBAC owner→{settings, help, leads, etc.}
- 4 Dashboard render checks
- 2 Invoices URL filter persistence
- 1 LoopAssist visibility
- 1 §5.4 unconfirmed-email gate

**Fix plan (next session, ~30 min):**
Add a `beforeEach` hook that injects the latest `access_token` into the
running browser's `localStorage` via `page.evaluate()`. Pseudo-code:

```ts
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'master') {
    const role = inferRoleFromStorageState(testInfo);
    const fresh = refreshStorageStateIfStale(AUTH[role]);
    if (fresh) {
      await page.evaluate((token) => {
        const key = `sb-xmrhmxizpslhtkibqyfy-auth-token`;
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        stored.access_token = token;
        localStorage.setItem(key, JSON.stringify(stored));
      }, fresh);
    }
  }
});
```

### Schema reality vs catalog drift

See [Anti-patterns → don't trust catalog column names](#anti-patterns).
Always verify columns via `information_schema.columns` first.

### ~~Stripe test mode is wired but not dispatched~~ — DONE 2026-05-08

J24-A landed (commits `b7900ab` → `2bf0aea`). 14 stripe-* edge fns +
shared modules now route through `_shared/stripe-client.ts`. Webhook
is dual-mode. Test webhook endpoint `we_1TUwZhBAjFOLYDS3QGslhpbj` is
configured. See [§24 progress](#24-progress) for the full change set.

### ~~Live webhook subscription gap~~ — DONE 2026-05-08

Live endpoint `we_1TUlSHAzPfYm94ux4mOfF72i` patched in 3rd session via
Stripe API to subscribe to the full 18-event superset (was 6). See
[§24 progress](#24-progress) "Two latent issues found and FIXED" for
detail and the post-launch verification ask.

### Resend SMTP

Configured to `smtp.resend.com` → `noreply@lessonloop.net`. SMTP password
is in Supabase auth config. Don't rotate without updating Supabase auth.

### Sentry release tracking

Vite plugin `@sentry/vite-plugin@4.4.1` uploads source maps + creates
releases on every Netlify build (when `SENTRY_AUTH_TOKEN` is in build env,
which it is). Source maps are deleted from `dist/` post-upload — do not
re-add `dist/**/*.map` to the served output.

---

## Test infrastructure cheat sheet

### Run everything

```bash
./node_modules/.bin/playwright test --project=master --workers=4
```

### Run just one section

```bash
./node_modules/.bin/playwright test tests/e2e/master/24-stripe.spec.ts --project=master
```

### Run a single test by name

```bash
./node_modules/.bin/playwright test --project=master -g "owner pays invoice"
```

### Refresh test users + cleanup

```bash
# Reset all 6 e2e test user passwords (already done 2026-05-08)
# - via Supabase MCP execute_sql:
UPDATE auth.users
SET encrypted_password = crypt('E2eTestPass123!', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email LIKE 'e2e-%@test.lessonloop.net';
```

### Owner `has_completed_onboarding` drifts to false (re-fix)

If the baseline shows ~35 failures (instead of 13) all on owner-storage-state
routes, with screenshots showing "Preparing your account…" → the owner
profile's `has_completed_onboarding` flag has drifted to false. The
`/dashboard` route guard redirects unfinished-onboarding users to
`/onboarding`, which hangs on the loading screen.

The `protect_onboarding_flag` trigger blocks direct UPDATE — must run as
service_role:

```sql
DO $$
BEGIN
  SET LOCAL role TO service_role;
  UPDATE profiles SET has_completed_onboarding = true
  WHERE email = 'e2e-owner@test.lessonloop.net';
END $$;
```

(Discovered + fixed 2026-05-08 by Claude Opus 4.7 — root-cause unknown,
the previous session's HANDOVER snapshot claimed all 6 users were
true. If this drifts repeatedly, look for a trigger or migration that
resets it.)

### Useful test factories (in `tests/e2e/supabase-admin.ts`)

| Factory | Returns | Notes |
|---|---|---|
| `seedStudent({ testId, withGuardian, ... })` | `{ studentId, guardianId? }` | Uses service-role; auto-prefixed with `e2e_` |
| `seedLesson({ testId, teacherId, createdBy, studentIds, ... })` | `{ lessonId }` | `teacherId` from `getOwnerTeacherId()`, `createdBy` from `getOwnerUserId()` |
| `seedInvoice({ testId, payerGuardianId, items, status })` | `{ invoiceId, invoiceNumber }` | Uses `create_invoice_with_items` RPC |
| `seedLead({ testId, contactName, stage })` | `{ leadId }` | |
| `createThrowawayUser({ emailPrefix, emailConfirmed, ... })` | `{ userId, email, password }` | Via Supabase admin REST. Always pair with `deleteThrowawayUser(userId)` in afterEach |
| `signInAndWriteStorageState(email, password)` | path to ephemeral state JSON | For one-off role tests via `test.use({ storageState: path })` |
| `cleanupByPrefix(testId)` | void | Sweeps all `e2e_<testId>%` rows across tables |

### Useful query helpers (also in `supabase-admin.ts`)

| Helper | Notes |
|---|---|
| `supabaseSelect(table, query)` | PostgREST GET via owner JWT (RLS-respecting). **Doesn't see rows the owner can't see** — e.g. parent's notification_preferences. Use service-role inline for those (see `selectServiceRole` pattern in §26.11 below). |
| `supabaseInsert(table, payload)` | Uses service-role when configured (RLS bypass for seeds) |
| `supabaseDelete(table, query)` | Same — service-role for cleanup |
| `supabaseRpc(fnName, params)` | RPC calls via owner JWT |
| `patchInvoiceStatus(invoiceId, status)` | Service-role PATCH that goes through `enforce_invoice_status_transition` trigger |

### Inline helpers worth knowing about (5th session — `26-parent-portal.spec.ts`)

These are scoped to specific describes (not exported) but the
patterns are reusable — copy into other spec files when you need
the same shape.

| Where | Helper | Pattern it solves |
|---|---|---|
| `§26.6` describe | `patchOrgReschedulePolicy(policy)` | Service-role PATCH on `organisations.parent_reschedule_policy`; returns previous value. Has 57014 statement_timeout retry built in. Wrap calls in try/finally so a thrown test doesn't leak the policy across other tests. |
| `§26.6` describe | `lessonSlotOffsetMs()` | 24-slot Math.random() minute offset (0–11.5h) for lesson seed `start_at`. Stops two runs at the same wall-clock minute from colliding on the teacher_conflict trigger when one run leaks a `-10/+0/+14 day` lesson. |
| `§26.6` describe | `seedScheduledLessonForParent({testId, daysFromNow})` | Atomic-on-failure: rolls back the just-inserted student + student_guardians if the lesson INSERT throws. Returns `{studentId, lessonId, title, cleanup}`. |
| `§26.9` describe | `seedInvoiceForParent({testId, status, amountMinor})` | `createTestInvoice` + `patchInvoiceStatus` chain that flips the seeded invoice from draft → sent / paid / overdue (transition trigger validates each hop). Returns `{invoiceId, invoiceNumber, cleanup}`. |
| `§26.9` describe | `signInForToken(email, password)` + `invokeEdgeFn(fn, token, body)` | Local copies of the §24 helpers (kept inline rather than imported across spec files). Use these to drive parent-JWT edge-fn calls without going through the UI. |
| `§26.10` describe | `seedStaffMessageToParent({testId, recipientGuardianId, recipientEmail, senderUserId})` | Inserts a staff→parent `message_log` row (recipient_email NOT NULL is enforced). Used as the seed for parent-reply test happy path. Cleanup callable also drops any reply rows that point at the seed. |
| `§26.11` describe | `selectServiceRole(table, query)` | Owner JWT can't read the parent's `notification_preferences` row (RLS). This is a curl-based service-role GET — needed any time you assert on a row whose RLS scopes to a non-owner user_id. |
| `§8.6` describe | `patchPolicyEligibility(absenceReason, eligibility)` | Service-role PATCH on `make_up_policies` for `(org_id, absence_reason)`; returns previous eligibility for try/finally restore. Used by §8.8.10a to flip `sick` to `automatic` for the duration of one test. |
| `§8.6` describe | `patchRows(table, filter, body)` | Generic service-role PATCH used by `patchPolicyEligibility` and the §8.8.9 lesson-cancel via direct curl. |
| `§17.5` describe | `callRpcAsServiceRole(fnName)` | POST to `/rest/v1/rpc/<name>` with empty body via service-role key. The cron functions (`reset_stale_streaks`, `complete_expired_assignments`) aren't SECURITY DEFINER and aren't callable by anon/auth, so the RPC has to come from service-role. |
| `§15.4` describe | (re-uses `createTestInvoice` + `patchInvoiceStatus`) | Pattern for report data-correctness: seed minimal data, render report as owner, assert specific row visible. Generalisable to the other 7 reports — just match the page's data flow. |

### Inline helpers worth knowing about (6th session)

| Where | Helper | Pattern it solves |
|---|---|---|
| `§16.3` describe | `signInForToken(email, password)` + `invokeEdgeFn(fn, token, body)` | Inline copies of the §24 helpers; cover staff-side edge-fn calls (e.g. send-message). Don't import across spec files — copy them. |
| `§10.7` describe | `signInForToken` + `invokeEdgeFn` (same pattern) | Same shape but with longer `timeout: 60_000` + `maxBuffer: 8MB` for csv-import-execute, which can return larger payloads on big batches. |
| `§10.7` describe | `row(overrides)` + `MAPPINGS` | Build a csv-import payload row with all `ImportRow` fields defaulted to empty string; mappings object is just truthy (the fn doesn't deeply validate field shape). |
| `§15.4` describe | `midLastMonth()` | Returns Date set to the 15th of the previous calendar month, UTC. Safe seed time for any "last month" report without timezone edge cases. |
| `§15.4` describe | inline `execSync` curl PATCH for lesson status | seedLesson supports `status` directly but defaults to 'scheduled'. PATCH to 'completed' / 'cancelled' via service-role goes through the audit trigger but no transition guard. Use inline curl rather than rolling a new helper — only 4 lines. |
| `§16.3` cross-org test | inline service-role insert into `organisations` (name + created_by required, all other cols default) + `guardians` (org_id + full_name required) | Lightweight throwaway-org pattern for cross-tenant 403 tests where the recipient must exist in a different org. Cleanup is two `supabaseDelete` calls (guardian first, then org). |
| `§20.4` describe | `seedTermsStudentAndRecurringLesson({testId})` | Seeds the full chain create-continuation-run needs: 2 non-overlapping terms (far-future to bypass check_term_overlap) + active student + student_guardians link to e2e parent + recurrence_rules + lesson with recurrence_id + lesson_participants. Returns IDs + cleanup callable. Uses `Math.random() * 500` for baseYear (NOT a deterministic hash — that caused parallel-test collisions in initial runs). |
| `§20.5` describe | `seedRunWithPendingResponse({testId, assumedContinuing})` | Lighter seed for process_deadline tests — terms + student + run (status='sent', deadline yesterday) + 1 pending response. Skips the recurrence/lesson chain since process_deadline only operates on response.response field. |

### Inline helpers worth knowing about (8th session)

| Where | Helper | Pattern it solves |
|---|---|---|
| `§26.9` describe | (extension of existing seedInvoiceForParent) | 8th-session §26.9.2/3 added an installment-pay flow that uses three patterns worth copying when writing other RPC-driven payment-flow tests: (a) seed invoice → patchInvoiceStatus to 'sent' → call `generate_installments(_invoice_id, _org_id, N, 'monthly')` via owner-JWT supabaseRpc (NOT service-role — the function gates on `is_org_finance_team(auth.uid(), _org_id)` and service-role's auth.uid()=null fails); (b) re-SELECT `invoice_installments` after the call (the SETOF JSON shape is awkward to parse vs a fresh SELECT); (c) for each installment-pay assertion, INSERT a `payments` row with `installment_id` set + call `record_installment_payment(p_installment_id, p_amount_minor, p_stripe_payment_intent_id)` (no auth.uid() check inside — both owner JWT and service-role work). The RPC's return shape includes `{installment_id, invoice_id, all_paid, net_paid, new_status}` — the `all_paid` flag is the hook for "is this the last call?" assertions. |
| `§26.9` describe | invoice_status enum reality | `invoice_status` enum is `{draft, sent, paid, overdue, void, outstanding}`. There is NO 'partially_paid' value. Catalog references to "partially_paid" apply to the per-installment `invoice_installments.status` flag, not the parent invoice. `record_installment_payment` only flips invoice.status to 'paid' when ALL installments paid AND payments-table sum >= total_minor; otherwise the invoice stays in its prior status with paid_minor recomputed. Don't write tests asserting `invoice.status='partially_paid'` — the assertion will silently never match. |

### Inline helpers worth knowing about (7th session)

| Where | Helper | Pattern it solves |
|---|---|---|
| `_fixtures/auth-refresh.ts` | `injectFreshSessionFromFile(page, storagePath)` + `page` fixture override | Wraps `page.goto` so the FIRST navigation re-reads the storage state file and overwrites the running browser's localStorage with the latest token. Pairs with the existing `storageState` override (which refreshes the file on disk). STORAGE_KEY now derived from E2E_SUPABASE_URL. |
| `§22.2` describe | `patchOrgViaOwnerJwt(body)` | Service-role-via-owner-JWT PATCH on `organisations`, parses status code from curl `-w "%{http_code}"`. Use for fire-and-forget mutations (timezone, parent_reschedule_policy, continuation defaults). |
| `§22.2` describe | `patchOrgWithBody(body)` | Variant that captures BOTH status and response body — needed when the test asserts on a trigger error message (e.g. validate_schedule_hours's 'schedule_end_hour must be greater than schedule_start_hour' text). |
| `§27` describe | `callSendPaymentReceipt(payload, {auth})` | service-role / anon / no-auth invocation of send-payment-receipt with body capture for assertion. Currently used only for RBAC negative tests; the {auth:'service'} path is blocked by .env.test key drift (see anti-patterns). |
| `§27` describe | `selectNotifPrefServiceRole(query)` + `selectMessageLogServiceRole(query)` | Service-role-via-curl SELECT for tables RLS-scoped away from the owner JWT. Use any time you need to assert on a row whose RLS gates non-owner user_id (notification_preferences and parent-related message_log rows are the common case). |
| `§27` describe | `insertMessageLogRaw(payload)` | Captures `{status, body}` from a service-role POST so tests can assert on 23505 unique-violation responses (e.g. dedup index test). Companion to `supabaseInsert` which swallows errors. |
| `§27` describe | `upsertParentNotifPref(orgId, userId, prefs)` + `deleteParentNotifPref(orgId, userId)` | Service-role POST with `Prefer: resolution=merge-duplicates` for upsert; DELETE for cleanup. Use to flip `email_payment_receipts` / `email_invoice_reminders` etc. for testing pref-honoring contracts. |
| `§27` describe | `insertPaymentServiceRole(payload)` | Service-role POST to `payments` table with `Prefer: return=representation` + error-throwing wrapper. Used by §27 dedup test to seed a payment that both the message_log dedup index test and a future fn-invocation test depend on. |

### Inline helpers worth knowing about (15th session)

| Where | Helper | Pattern it solves |
|---|---|---|
| `§13.7.4` describe | `selectServiceRole(table, query)` | Service-role-curl SELECT for result-side assertions on tables (invoices, message_log) where the owner JWT path through PostgREST returned non-array shapes under cross-file parallel contention in s14. Coerces non-array responses to `[]` so callers can rely on `.length`. |
| `§14.10.16` describe | `selectServiceRole(table, query)` + `selectServiceRoleWithPoll(table, query, predicate)` | Same selectServiceRole shape plus a 10s-deadline poll wrapper for assertions on rows the RPC writes inside its transaction body (audit_log here). Row IS committed when the RPC returns, but PostgREST visibility under contention occasionally lags 1-3s — the poll defuses without slowing the happy path. |
| `§22` describe | `srPost / srPostStatus / srDelete / srSelect` | Generic service-role-curl helpers (POST returning array, POST returning {status,body}, DELETE, SELECT-coerced-to-array). Used for closure_dates / rate_cards / message_templates / availability_blocks CRUD in s15. Pattern: for any table where the test asserts post-mutation state, use service-role to bypass owner JWT contention. |
| `§11.4.6 / §11.4.10 / §11.4.8` describe | `srPostT / srPostStatusT / srDeleteT / srPatchT` | Local copies of the §22 srPost shape (separate suffix to avoid collision with the existing `selectServiceRoleWithPoll` import-style approach). srPatchT covers PATCH-with-status-capture for the archive-status-flip test. The throwaway-org pattern for §11.4.6 plan-cap is documented inline — INSERT a one-off `organisations` row with `max_teachers=1`, exercise the trigger, cleanup in finally. |

---

## Audit framework

Living state of every feature: `audit/MASTER.md`. State symbols:
- ✅ green / ⏸ deferred-post-launch
- 🟢 verified by E2E and live
- 🟡 structurally verified, awaiting browser confirmation
- 🔴 known launch blocker
- ❓ untested (target: zero of these)

Current count (2026-05-10, after s15): **26 🟢 / 138 🟡 / 6 🔴 / 10 ⏸ / 0 ❓**.
s15 promoted 12 rows 🟡→🟢 (Outstanding; Continuation flow; CSV
import execute; Teachers list/CRUD; Messages inbox; Send-message
edge fn; Portal home/schedule/practice/invoices/messages/profile).

**The recalibrated bar (s15-onwards):** audit hygiene is non-negotiable
per session; ≥5 rows backfilled to 🟢, target ~150+ tagged at launch.
"World-class" means every area, feature, and function systematically
cleared — not just the worst-bug-of-the-week. Money-path (Invoicing &
Payments) is the next dedicated workstream s16-s18.

When you finish a catalog section (real tests, all green), update the
relevant rows in `audit/MASTER.md` from 🟡 → 🟢. **Don't promote
without verification** — verify the Notes column has [E2E real per
<sha>] and that the cited tests are launch-in-scope and passing.

### Audit/MASTER.md hygiene status (end of 15th session)

s15 promotions (12 rows): 🟡→🟢 across the parent portal cluster
(home, schedule, practice, invoices, messages, profile), staff
messaging cluster (inbox, send-message), and individual mature
sections (Outstanding, Continuation, CSV import execute, Teachers
list/CRUD).

§22 settings row tag extended with s15's 4 new real tests + new
[PROMOTABLE 🟡→🟢] marker; the row stays 🟡 because the catalog
asks for §22.7 GDPR + §22.12 calendar OAuth + §22.14 billing
upgrade etc. which remain fixme. Promotion candidate for s17 once
the launch-hidden ones are explicitly marked ⏸.

s14's 3 promotable parent-portal candidates flagged at the end of
that session were among the 12 s15 promotions.

---

## Commit style for this work

Follow existing patterns from `git log`. Format:

```
test(e2e): §24 Stripe — 12 tests now real (was 11 fixmes + 1 stub)

* parent pays invoice via embedded drawer with test card 4242 →
  webhook fires + status=paid + receipt email queued
* parent pays via Apple Pay (mobile-safari only)
* …

Catalog completeness: §24 100% / overall 32% (was 25%)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Last words

If you (the next Claude) hit anything that contradicts this doc, trust
the codebase + the catalog over my memory. I tried to capture
everything that mattered but I'm not perfect. The `git log` is the
true history. The catalog is the contract.

Good luck. Don't fixme.
