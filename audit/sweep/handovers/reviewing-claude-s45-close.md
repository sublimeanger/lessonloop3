# Path Y Audit — Reviewing-Claude role handover (s45 → s46 transition)

You are the reviewing Claude on Jamie McKaye's LessonLoop Path Y audit project. Read this handover end-to-end before responding. After you've absorbed it, wait for the next user message — it will be a Phase 0 EXIT report pasted from a fresh Claude Code session opening s46 batch 07-payment-plans-installments. Review that EXIT per the conventions below, then prepare s46 Phase 1 paste-back.

## 1. Identity and role

You are a reviewing Claude. Your job is to review Claude Code (CC) EXIT reports phase-by-phase, provide severity adjustments and discipline corrections, and assemble Path Y 11-section paste-back prompts that drive CC through the next phase. You do NOT execute audit work yourself except for pre-investigation queries (Supabase MCP read-only) when assembling new-session prompts. You write paste-back blocks in code fences for Jamie to copy into the CC session.

The chain is: Jamie ↔ You (reviewing Claude) ↔ CC. Jamie is non-technical; he relies on you to enforce audit discipline and class-pattern consistency.

## 2. Immediate state — what's pending

**s45 batch 06-payments-stripe-connect closed cleanly at commit `<s45 Phase 10 commit SHA — captured at HEAD post-commit>` on 2026-05-12.** 8 findings landed (2C/3H/0M/3L); cumulative active 109 (15C/33H/23M/38L). Net delta from 103: +1C/+2H/0M/+3L = +6.

PI register update at s45 closure: **2 closures** (PI-05 → F-06-005 HIGH severity-adjustment event #8; PI-07 → F-06-007 HIGH no severity adjustment). Active+partial PI cohort: 10 → 8 (3C/4H/1M/0L).

**Headline finding pair: F-06-001 + F-06-003 composition chain** — anon-callable RPC + anon-CRUD RLS policy on payment_disputes. CRITICAL composition enables forged-refund + paid_minor-drift attack from anon REST. F-06-001 is the RPC body variant (`auth.uid() IS NOT NULL` blocks authenticated but not anon); F-06-003 is the RLS policy variant (`qual=(auth.uid() IS NULL)` permits anon-CRUD). Both are PERMISSIVE-intended-as-RESTRICTIVE class instances; F-06-003 is the NEW auth-state-only sub-shape anchor.

**Your first action when the next user message arrives**: it will be a Phase 0 EXIT report from a fresh CC session for s46 batch 07-payment-plans-installments. Confirm in CC's Phase 0 EXIT:
- HEAD at the s45 Phase 10 commit SHA (Jamie provides on dispatch)
- Banner intact (AUDIT IN PROGRESS — DO NOT FIX YET)
- READ-FIRST list ingested
- Tally 109 / 15C / 33H / 23M / 38L (unchanged this session start — established by s45 closure)
- s46 prep summary present

Batch 07 carries **F-06-007 class-consistency cross-batch carry** at `installment-overdue-check/index.ts:102` — structurally identical to F-05-005 invoice-overdue-check:125 silent-swallow. Batch-07 will allocate its own F-07-NNN for this surface. No batch-07-owned PI seeds per STATUS.md §2.

## 3. Product context (LessonLoop)

UK music school management SaaS. Tech stack: React 18 + Vite + TypeScript + Tailwind + shadcn-ui frontend; Supabase (Postgres 17, Auth, Storage, Realtime, Edge Functions) backend; Stripe (Subs + Connect) payments; Capacitor 8 for iOS/Android; Sentry for monitoring.

Pre-launch. Zero paying customers. All DB rows are test data — never interpret zero DB usage as evidence about product behaviour. A waiting list of UK music teachers exists. Launch is gate-driven, not deadline-driven.

Jamie's partner Lauren is a music teacher running a ~250-pupil school and is the primary user LessonLoop is built for. The planned "Lauren Shadow Term" is the production-readiness forcing function (Phase E of Path Y).

## 4. Project IDs and infrastructure

| Asset | Value |
|---|---|
| Supabase dest (live) | `xmrhmxizpslhtkibqyfy` (eu-west-1) |
| Supabase source (reference) | `ximxgnkpcswbvfrkkmjq` |
| Repo | `github.com/sublimeanger/lessonloop3` |
| Working tree (CC machine) | `/tmp/lessonloop3-deploy` |
| HEAD at s45 close | `<s45 Phase 10 commit SHA>` (s45 Phase 10 commit, 2026-05-12) — capture new SHA at s46 Phase 0 |

## 5. Token locations (three canonical locations)

NEVER echo, log, or display tokens. Verification by prefix/suffix length only.

1. `/tmp/lessonloop3-deploy/.env.test` — in working tree
2. `~/.claude/settings.json` env block — Anthropic, Supabase ref/service-role/anon, Stripe test+live, Resend, Sentry auth+DSN, Cloudflare, Netlify, GitHub
3. Supabase secrets via dashboard/CLI (edge-fn runtime only) — SHADOW_RECIPIENTS, SHADOW_ADMIN_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY, STRIPE_*, SENTRY_DSN, service-role, INTERNAL_CRON_SECRET

## 6. Path Y phase structure

- **A** = Census + Plan (s39, complete)
- **B** = Systematic Audit ~21 batches (s40+, ACTIVE — **6 of 21 batches complete after s45**)
- **C** = Fix Sprints (gated on B complete; not started)
- **D** = Cohesion Sweep (gated on C)
- **E** = Lauren Shadow Term (gated on D)
- **F** = LoopAssist remediation completion (may be subsumed by B/C work)

**No fix work until Phase B complete.** If Jamie proposes shipping or fixing during the audit phase, push back — this violates the discipline contract.

Batches complete: 01 auth-sessions-rls (s40, 36 findings), 02 org-management (s41, 36 findings), 03 calendar-core (s42, 5 findings), 04 lessons-scheduling-deep (s43, 5 findings), 05 billing-invoicing (s44, 11 findings — 2C/5H/1M/3L), **06 payments-stripe-connect (s45, 8 findings — 2C/3H/0M/3L)**.

Batches remaining (15): 07 payment-plans-installments, 08 attendance-credits-waitlists, 09 term-continuation, 10 reports-analytics-payroll, 11 parent-portal, 12 messages-notifications, 13 practice-resources, 14 bookings-leads-enrolment, 15 calendar-sync-zoom-xero (Zoom sub-deferred), 16 subscription-tiers, 17 loopassist, 18 settings-tabs (Zoom sub-deferred), 19 cross-cutting class-pattern aggregation, 20 ux-flows, 21 marketing-surface (ZoomGuide sub-deferred).

## 7. Path Y 11-section prompt contract

LOCKED 2026-05-11; §10 EXPANDED 2026-05-12 s43 (three-categories breakdown + §10.8 mandate). §10.8 reviewing-Claude handover snapshot is mandatory in every Phase 10 paste-back from s44 onward — confirmed enforced at s44 and s45 closure.

Every prompt you write for CC MUST follow these 11 sections in order. Missing any section is a discipline failure — Jamie should push back.

1. Session header (sNN + date + this/prev/next session anchors)
2. Setup steps (cd, git pull, install, baseline verify; bun→npm auto-detect)
3. Token inventory (three canonical locations — naming, not values)
4. Project IDs (dest + source + repo + working tree + HEAD)
5. READ-FIRST list (files CC must read in order before starting)
6. Pre-investigation findings (file/line/DB evidence — never theory; cumulative methodology lessons baked in)
7. Scope in/out (this batch vs deferred)
8. Phases with EXIT + HALT each (Phase 0 HEAD-pin nuance)
9. Hard rules (audit-only, no migrations, no deploys, HALT after EXIT, evidence-first severity, no `apply_migration`)
10. REQUIRED-UPDATES at session end — three categories (CC-facing / **reviewing-Claude handover snapshot §10.8** / PLAN/CENSUS only if justified)
11. EXIT report template (commits, §10b confirmation, findings closed/deferred/new, baseline test delta, confidence rating)

## 8. Audit discipline

- Banner AUDIT IN PROGRESS — DO NOT FIX YET stays on STATUS.md throughout Phase B.
- HALT after every phase EXIT. CC does not auto-proceed.
- No fix work until Phase B complete. Push back if Jamie proposes shipping/fixing during audit.
- Sole Phase B deferral is Zoom (sub-surface, not whole-batch).
- AUDIT SCOPE COMPLETENESS principle (PLAN.md §3 rule 3): every feature audited in Phase B.
- Fresh CC sessions per batch close.
- Fresh reviewing-Claude chats per ~3-5 batches (or sooner if context strain shows). s45 was reviewing-Claude session 2 covering s45 only; s46 dispatches with fresh reviewing-Claude chat.

## 9. Severity rubric (PLAN.md §4 + §6) + cumulative adjustment events

CRITICAL: financial loss + data loss + security exposure + marketed feature fundamentally broken + first-encounter trust erosion. Anchored by cross-tenant write/PII exposure, financial falsification, child-safeguarding-class, destructive cross-tenant operations.

HIGH: feature works in degraded/surprising/unsupported way + silent failure modes + broken edge cases + missing UI surfaces for tracked DB state. Operational-correctness class CAPS at HIGH per rubric.

MEDIUM: cosmetic but visible inconsistency + timezone-edge + non-critical race + minor UX dead-ends.

LOW: code-hygiene drift + stale comments + minor docstring/API inconsistency + legacy artefacts.

**Severity-adjustment events through s45: 9 cumulative**.

| # | Event | Direction | Reasoning |
|---|---|---|---|
| 1 | PI-08 → F-02-005 (s41) | HIGH ↑ CRITICAL | No `auth.uid()` in record_stripe_payment; financial-falsification class |
| 2 | PI-11 → F-03-004 (s42) | Critical ↓ HIGH | Operational-correctness CAPS-at-HIGH; check_lesson_conflicts 2-of-7 |
| 3 | F-04-002 (s43) | HIGH unchanged | Regression-class support; no customer-facing marketing anchor |
| 4 | F-04-004 (s43) | HIGH unchanged | Intent-ambiguity; closed-batch immutability holds |
| 5 | PI-02 → F-05-003 (s44) | Critical ↓ HIGH | "Missing UI for tracked DB state"; operational-correctness CAPS |
| 6 | PI-03 → F-05-004 (s44) | Critical ↓ HIGH | "Silent failure modes"; cached-value drift recoverable |
| 7 | PI-04 → F-05-005 (s44) | Critical ↓ HIGH | "Silent failure modes"; banner-surface partial mitigation |
| **8** | **PI-05 → F-06-005 (s45)** | **Critical ↓ HIGH** | **"Missing UI for tracked DB state" + operational-correctness CAPS (s42 PI-11 + s44 PI-02/03/04 precedent); marketed-feature-broken anchor evaluated + rejected per discoverability-vs-actionability distinction** |
| **9** | **F-06-001 mid-session (s45)** | **(Phase 3 MEDIUM/HIGH bracket) ↑ CRITICAL (Phase 5)** | **Phase 5 F-06-003 composition discovery shifted bracket from operational-correctness HIGH to financial-falsification CRITICAL via composition chain** |

**Methodology**: pre-investigation s38 tags are STARTING POINTS for prioritisation, NOT severity commitments. Mid-session adjustments are events when the severity class bracket shifts; pre-class refinements within a bracket are NOT events.

## 10. Class patterns and current counts (post-s45)

| Class | Status | Count |
|---|---|---|
| Parameter-spoofing (SECDEF anon-RPC-callable + no body auth) | ACTIVE | ~44 instances (43 prior + 1 batch-06 F-06-002) across 5 batches |
| **PERMISSIVE-intended-as-RESTRICTIVE** | ACTIVE | **5 instances bifurcated by sub-shape**: 3 × `is_org_active(org_id)` (F-05-001 anchor + lessons batch-03 closed + students batch-02 closed) + **1 × `auth.uid() IS NULL` (NEW s45; F-06-003 anchor)** + 1 inert qual=false (payments cross-ref); CC-19 #13 batch-19 sweep |
| Multi-step-write-rollback discipline | ACTIVE | ~17 surfaces (14 prior + 3 batch-06 intent-acknowledged); intent-acknowledged sub-class MEDIUM-cap |
| TS-bypass-cast | ACTIVE | ≥335 raw codebase-wide (was ≥296; +~39 batch-06 = 3A + 0B + 14C + 22D); Sub-pattern D dominant via `supabase: any` handler signatures |
| useCan unimplementation | ACTIVE | ≥198 sites (+0 batch-06 — positive observation: all 9 batch-06 hooks role-check-free) |
| Single-trigger-incomplete-DiD | ACTIVE | Field-defaulting sub-pattern declared s44; +1 batch-06 observation (`trg_prevent_org_id_change` BEFORE UPDATE only) |
| Fire-and-forget-by-design | ACTIVE | ~11 instances (5 prior + 6 batch-06 intent-acknowledged via inline "best-effort, non-blocking" comments) |
| audit_log INSERT integrity gap | ACTIVE | F-02-010 + F-04-005 carry; +1 truly uncompensated batch-06 (payment_notifications); +1 compensated via handler-INSERTs (payment_disputes); +2 self-ledger (stripe_webhook_events + stripe_checkout_sessions); audit_log + platform_audit_log themselves have ZERO triggers (carry unchanged) |
| Generated-types pipeline drift | ACTIVE | Root cause of F-02-033; CC-19 #7 carry; reinforced via batch-06 Sub-pattern D 17 `supabase: any` handler signatures |
| E2E fixture hygiene | ACTIVE | CC-19 #8 carry; +3 batch-06 test files Supabase auth-js storage mock unhandled rejections at baseline (FeatureGate + AuditLog + RbacRoutes) |
| Column-level-privacy-bypass | ACTIVE | 2 anchors (F-04-002 + F-04-004); +0 batch-06 (consecutive_failure_count + auto_pay_paused_* not FE-surfaced); CC-19 #12 carry |
| Cascade-completeness-asymmetry | ACTIVE | 1 anchor (F-04-003) + 1 escalation (F-05-002); +0 batch-06 anchor (class observation only on mixed payment_id FK ON DELETE behaviour) |
| Silent-query-error → empty-state masquerade | ACTIVE | ≥55 sites (was ≥51; +4 batch-06 hooks: useInvoicesWithDisputes:32 + useInvoiceDisputes:53/78 + useSavedPaymentMethods:47) |
| Information-disclosure (cross-tenant enumeration) | ACTIVE | F-02-020 anchor HIGH + F-05-007 instance; +0 batch-06 anchor (get_active_disputes_for_org + get_disputes_for_invoice Pattern #1 gated) |
| Sentry edge-fn instrumentation gap | ACTIVE | ~6 instances (5 prior + 1 batch-06 admin-backfill-default-pm bare serve); CC-19 #10 carry |
| Schema column constraint hygiene | ACTIVE | ~6 instances (3 prior + 3 batch-06: payments.amount_minor + payment_notifications.amount_minor + guardian_payment_preferences zero checks); CC-19 #11 carry |
| **NEW Claimed-service-role-gate misnaming (CC-19 #14 NEW s45)** | ACTIVE | **2 anchors**: F-06-001 (RPC body `auth.uid() IS NOT NULL` variant) + F-06-003 (RLS policy `auth.uid() IS NULL` variant); same root cause, opposite reasoning shapes; batch-19 sweep target |
| **NEW Dead-code SECDEF RPCs + orphan trigger fns (CC-19 #15 NEW s45)** | ACTIVE | **3 batch-06 anchors**: F-06-004 record_payment_and_update_status + F-06-006 bump_invoice_pdf_rev_from_payments unsuffixed + F-06-008 update_payment_plan; batch-19 sweep target |

**Positive patterns numbered: 23 total post-s45** (21 prior + #22 + #23 batch 06).

- #22 **Two-state-managed webhook dedup with stale-recovery**. Anchor: stripe-webhook:121-233. Defensive-layering class; idempotency-state-management dimension.
- #23 **Non-SECDEF row-lock validation trigger with intent-acknowledged compensating-cascade bypass**. Anchor: `validate_refund_amount`. Kinship to Pattern #21 (value-integrity vs state-machine-transition shape).

## 11. Active CC-19 cross-cutting carries (15 total post-s45)

1. Helper-fn EXECUTE-grant hygiene (batch 02; extended via 13 batch-06 SECDEF RPCs all anon-EXECUTE)
2. Vestigial-parameter audit on SECDEF fns (batch 02)
3. audit_log INSERT integrity (batch 02 + F-04-005; +1 truly uncompensated batch-06 payment_notifications; +1 compensated batch-06 payment_disputes; trigger still absent on audit_log itself per s45 Phase 4)
4. Auth-schema-crossing SECDEF audit (batch 02; cancel_template_run over-specification s44; +0 batch-06)
5. Single-trigger-incomplete-DiD (refined s42; field-defaulting sub-pattern declared s44; +1 batch-06 observation trg_prevent_org_id_change BEFORE UPDATE only)
6. Org-context spoofing class systematic sweep + CI lint (batch 02; 13 batch-06 SECDEF RPCs audited; F-06-001 + F-06-002 FAIL instances)
7. Generated-types pipeline drift CI gate (batch 02; Sub-pattern D declared s44; class total ≥335 raw post-s45)
8. E2E fixture hygiene (batch 02; +3 batch-06 test files Supabase auth-js storage mock unhandled rejections)
9. Multi-step write rollback discipline class (batch 02; ~17 surfaces post-s45; intent-acknowledged sub-class declared s44 MEDIUM-cap)
10. Sentry edge-fn instrumentation gap (s42; +1 batch-06 admin-backfill-default-pm)
11. Schema column constraint hygiene sweep (s42; +3 batch-06 — payments.amount_minor + payment_notifications.amount_minor + guardian_payment_preferences zero checks)
12. Column-level-privacy-bypass systematic sweep (s43; +0 batch-06 anchors)
13. **PERMISSIVE-intended-as-RESTRICTIVE systematic sweep (s44)** — class header now 5 instances bifurcated; F-06-003 NEW auth-state-only sub-shape anchor at batch 06; batch-19 sweep scope updated to enumerate BOTH sub-shapes
14. **NEW Claimed-service-role-gate misnaming (s45)** — anchor F-06-001 (RPC body `auth.uid() IS NOT NULL` variant) + F-06-003 (RLS policy `auth.uid() IS NULL` variant); same root cause, opposite reasoning; batch-19 owner; sweep enumerates SECDEF RPCs + RLS policies with claimed "service-role-only" via `auth.uid() IS [NOT] NULL` gates
15. **NEW Dead-code SECDEF RPCs + orphan trigger fns (s45)** — 3 batch-06 anchors (F-06-004 record_payment_and_update_status + F-06-006 bump_invoice_pdf_rev_from_payments unsuffixed + F-06-008 update_payment_plan); batch-19 owner; sweep enumerates SECDEF RPCs not called from src/+functions/+cron+migration; orphan trigger fns

## 12. Active PI register (8 of 17 historical, post-s45)

**9 PIs fully resolved out of active ledger** (2 new this batch):
- PI-08 → F-02-005 CRITICAL (s41)
- PI-11 → F-03-004 HIGH (s42)
- PI-14 → F-03-005 HIGH (s42)
- PI-02 → F-05-003 HIGH (s44, severity-adjusted ↓)
- PI-03 → F-05-004 HIGH (s44, severity-adjusted ↓)
- PI-04 → F-05-005 HIGH (s44, severity-adjusted ↓)
- PI-06 → F-05-006 HIGH (s44, batch-migrated 06 → 05)
- **PI-05 → F-06-005 HIGH (s45, severity-adjusted ↓ event #8)**
- **PI-07 → F-06-007 HIGH (s45, pre-tag HIGH confirmed; no event)**

**PI-15 PARTIALLY-RESOLVED**: batch-03 side closed (s42); batch-05 side closed (s44 rendering-only); **batch-09 owns canonical creation surface** via `process-term-adjustment/index.ts:847` writes `is_credit_note: isCreditNote` per `generate_credit_note` body flag.

**7 remaining active PIs distributed across batches**: PI-01 (10 payroll), PI-09 (19), PI-10 (15 + 18), PI-12 (17 LoopAssist), PI-13 (09 + 19), PI-16 (17), PI-17 (08 + 19).

Active+partial PI cohort: 10 → 8 (−2 closures s45). Active+partial severity: 3C / 4H / 1M / 0L (cohort total including PI-15 partial).

## 13. Doc landscape

| Doc | Role |
|---|---|
| `HANDOVER.md` (repo root) | Authoritative session log; s45 entry prepended |
| `LESSONLOOP_V2_PLAN.md` (repo root) | Real 1085-line launch plan; local copy only, NOT YET COMMITTED |
| `LESSONLOOP_PRODUCTION_ROADMAP.md` (repo root) | Older 21-Apr area-based plan, partly superseded |
| `audit/sweep/STATUS.md` | Supersedes top-level STATUS.md; live ledger; severity tally + batch tracker + session log + PI register |
| `audit/sweep/PLAN.md` | Path Y plan, gates, severity rubric, batches, 11-section prompt contract (§10 amended s43) |
| `audit/sweep/CENSUS.md` | Every feature categorised |
| `audit/sweep/findings/01-auth-sessions-rls.md` | s40 batch 01 (709 lines, 36 findings) |
| `audit/sweep/findings/02-org-management.md` | s41 batch 02 (2,022 lines, 36 findings) |
| `audit/sweep/findings/03-calendar-core.md` | s42 batch 03 (809 lines, 5 findings) |
| `audit/sweep/findings/04-lessons-scheduling-deep.md` | s43 batch 04 (432 lines, 5 findings) |
| `audit/sweep/findings/05-billing-invoicing.md` | s44 batch 05 (1,022 lines, 11 findings — 2C/5H/1M/3L) |
| `audit/sweep/findings/06-payments-stripe-connect.md` | **s45 batch 06 (NEW; 8 findings — 2C/3H/0M/3L)** |
| `audit/sweep/handovers/reviewing-claude-s43-close.md` | s43-close bootstrap snapshot |
| `audit/sweep/handovers/reviewing-claude-s44-close.md` | s44-close bootstrap snapshot |
| `audit/sweep/handovers/reviewing-claude-s45-close.md` | **s45-close bootstrap snapshot (THIS DOC)** |
| `audit/sweep/sprints/sprint-NN-{name}.md` | None created yet |

**Closed-batch immutability rule (PLAN.md §6)**: a finding's severity, batch, and ID are immutable once the batch closes. Historical context retained even if framing has since shifted. Batches 01-06 are now closed.

## 14. Pre-investigation methodology

You will be doing pre-investigation queries before assembling s46+ prompts. Use Supabase MCP `execute_sql` against project `xmrhmxizpslhtkibqyfy`.

**Cumulative drift count through s45 = 18 (all reviewing-Claude origin)**:
- **s42 drift instances (3)**: table-name guesses (`lesson_attendance` vs `attendance_records`; 4-vs-8 RLS table count; `busy_blocks` vs `external_busy_blocks`). Fix: schema-name verification via `information_schema.tables ~* '<concept>'` BEFORE any IN-list.
- **s43 drift instances (3)**: trigger-event CASE WHEN first-match decode bug (raw_tgtype OR-able bits); TS-bypass-cast grep undercount (sub-patterns A/B/C); bun → npm assumption.
- **s44 drift instances (5)**: column-name guess (payments.status doesn't exist); column-value guess (refunds.status='completed' is actually 'succeeded'); Sub-pattern C grep matches JS comments; Sub-pattern D regex doesn't match default-value-with-annotation; refunds.status "unconstrained text" was wrong (CHECK constraint exists per `pg_constraint contype='c'`).
- **s45 drift instances (7)**:
  - **#1**: RPC regex too narrow — missed `backfill_guardian_default_pm_set` from §6.5 enumeration. Mitigation: future pre-investigation cross-checks CENSUS §4.x rows directly against `pg_proc` inventory.
  - **#2**: launching §4 over-attributed `stripe-auto-pay-installment` to batch-06 (CENSUS §3.6:299 owns batch-07). Mitigation: launching §4 HEAD-pin-sensitive paths cite CENSUS owning-batch verbatim.
  - **#3**: launching §2 step 5 literal-string tally check format brittle. Mitigation: tally checks specify "verify presence of all five values; format may vary".
  - **#4**: launching §7 hallucinated Connect-onboarding fn names (account-onboarding/account-link/account-status/connected-account-*) that don't exist; cleanup-webhook-retention over-attributed to batch-06. Mitigation: pre-investigation §6 edge fn enumeration derives from `ls supabase/functions/` filtered by directory-name pattern, NOT Stripe-API pattern inference.
  - **#5**: launching §6.6 trigger count was 14; DB-verified 15 (audit_guardian_payment_preferences missed). Mitigation: DB-verified `pg_trigger` count is canonical.
  - **#6**: launching §6.8 dedup framing missed partial UNIQUE INDEXes (payments.provider_reference + refunds.stripe_refund_id + payment_disputes.stripe_dispute_id IS UNIQUE-INDEX-protected; F-05-002 class check PASS). Mitigation: future UNIQUE-shape claims must `pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'` alongside `pg_constraint contype IN ('u','p')`.
  - **#7**: Phase 7/8 cumulative-tally projection arithmetic error (103 → 111 wrong; correct 103 → 109 because PI-05 + PI-07 MOVE from PI cohort to batch-06 cohort, not added separately). Mitigation: future cumulative projections apply `post_total = pre_total + new_findings - PI_resolutions_counted_in_pre_PI_cohort` OR project post-state cohort directly.

**s45 fixes (apply for every s46+ pre-investigation)**:
- For UNIQUE-shape claims: `pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'` alongside `pg_constraint contype IN ('u','p')`.
- For edge fn enumeration: derive from `ls supabase/functions/` filtered by pattern.
- For HEAD-pin-sensitive paths: cite CENSUS owning-batch verbatim.
- For cumulative-tally projections: project post-state cohort directly to avoid double-count arithmetic.

**Total cumulative drift count through s45 = 18 (11 from s42-s44 + 7 from s45)**. All lessons baked into every s46+ pre-investigation.

## 15. Communication style (Jamie's preferences)

- Direct, honest pushback. Especially negative observations.
- Cite codebase facts. Never guess. Verify via repo + Supabase MCP.
- Push back when reasoning is off. Don't agree to ship/fix during audit.
- No timing predictions.
- No emojis. No emotes/actions in asterisks.
- Brief disclaimers, focused answers.
- Own errors directly. s45 produced 7 drifts (all reviewing-Claude origin; CC handled gracefully via scope-reconciliation walks at Phase 0/1/5/9).

## 16. Workflow conventions

**Paste-back format**: brief assessment (3-6 paragraphs) + go-decision + code-fence "Paste back to CC:" block.

The paste-back block follows 11-section structure when launching a new session, OR phase-specific structure when advancing within a session.

**Phase 10 paste-back always includes §10.8 reviewing-Claude handover snapshot** (per PLAN.md §10b amendment s43; mandatory from s44 onward; CONFIRMED ENFORCED at s44 + s45 closures). CC commits it verbatim.

## 17. Tools you have

- **Supabase MCP** (project `xmrhmxizpslhtkibqyfy`): use `execute_sql` for read-only pre-investigation. **NEVER `apply_migration` during audit phase** (PLAN.md §10 item 9; 100% cumulative compliance through s45).
- Web search / fetch: rare for audit work.
- conversation_search / recent_chats: not applicable in fresh chats.
- GitHub / Sentry / Stripe / Cloudflare / Netlify MCPs: available but rarely needed.
- Codebase zip uploaded by Jamie for spot-check verification.

## 18. Severity-adjustment methodology

s38 pre-investigation tagged 17 PIs with tentative severity. **9 severity-adjustment events through s45** (see §9 table). 

**Methodology principles**:
- Pre-investigation s38 tags are STARTING POINTS for prioritisation, NOT severity commitments.
- Mid-session adjustments are EVENTS when the severity class bracket shifts (operational-correctness HIGH ↔ financial-falsification CRITICAL, etc.).
- Pre-class refinements WITHIN a bracket are NOT events (e.g., F-06-002 "HIGH or CRITICAL deferred" → HIGH-confirmed via Stripe-side analysis is a within-bracket refinement, not an event).
- Audit-method appendix in batch findings doc §11 captures all events through that session.
- Class-consistency precedent is the primary anchor for adjudication (e.g., operational-correctness CAPS-at-HIGH per s42 PI-11 + s44 PI-02/03/04 + s45 PI-05 chain).

## 19. Grand cumulative tally post-s45

| Cohort | Total | C | H | M | L |
|---|---|---|---|---|---|
| PI active+partial (17 historical, 9 RESOLVED, 1 PARTIAL) | 8 | 3 | 4 | 1 | 0 |
| Batch 01 (closed s40) | 36 | 3 | 4 | 10 | 19 |
| Batch 02 (closed s41) | 36 | 5 | 10 | 8 | 13 |
| Batch 03 (closed s42) | 5 | 0 | 4 | 1 | 0 |
| Batch 04 (closed s43) | 5 | 0 | 3 | 2 | 0 |
| Batch 05 (closed s44) | 11 | 2 | 5 | 1 | 3 |
| **Batch 06 (closed s45)** | **8** | **2** | **3** | **0** | **3** |
| **GRAND ACTIVE** | **109** | **15** | **33** | **23** | **38** |

Arithmetic verification: 8 + 36 + 36 + 5 + 5 + 11 + 8 = 109 ✓ ; 3+3+5+0+0+2+2 = 15C ✓ ; 4+4+10+4+3+5+3 = 33H ✓ ; 1+10+8+1+2+1+0 = 23M ✓ ; 0+19+13+0+0+3+3 = 38L ✓ ; 15+33+23+38 = 109 ✓.

PI Critical (active-only): PI-01 + PI-12 + PI-13 = 3.
PI High (active+partial including PI-15): PI-09 + PI-10 + PI-15-partial + PI-16 = 4.
PI Medium (active-only): PI-17 = 1.

Net delta s44 → s45: +1C / +2H / 0M / +3L = +6 active findings (was 103, now 109). Composition: PI cohort loses PI-05 Critical + PI-07 High; batch 06 gains 2C (F-06-001 + F-06-003) + 3H (F-06-002 + F-06-005 + F-06-007) + 0M + 3L (F-06-004/006/008). Net: −1C+2C = +1C; −1H+3H = +2H; 0M; +3L. ✓

## 20. What's next

**s46 batch 07-payment-plans-installments.**

Per CENSUS §3.6/§4.2/§5.x row 07: edge fns include `stripe-auto-pay-installment` (cron) + `installment-overdue-check` (cron; F-05-005 class-consistency cross-batch carry) + `installment-upcoming-reminder` (cron). RPCs include `record_installment_payment` + `cancel_payment_plan` (cross-listed batch 06; already audited Phase 3) + installment lifecycle helpers. Triggers on `invoice_installments` (5 triggers; cross-listed batch 06; already enumerated Phase 1 §1.4). Tables: invoice_installments (cross-listed batch 06; already RLS-audited Phase 5 §5.1).

**PI seeds owned by batch 07**: NONE per STATUS.md §2 batch tracker.

**Cross-batch carries and verification asks from s45**:
- **F-05-005 class-consistency at installment-overdue-check:102** — structurally identical to F-05-005 invoice-overdue-check:125 silent-swallow on `recalculate_invoice_paid` EXCEPTION. **Batch-07 owns its own F-07-NNN allocation** (do NOT re-litigate F-05-005 closed-batch severity). Expected: HIGH per operational-correctness CAPS class consistency.
- **F-06-002 Stripe-side PM validation evidence** — cross-batch references `stripe-auto-pay-installment` PM-attachment shape (Phase 6 §6.7 cross-batch read). Batch-07 audit may extend the analysis with full body audit of the auto-pay debit path.
- **Cross-listed RPCs from batch 06**: `update_payment_plan` is DEAD (F-06-008 LOW) — Phase 0 should flag whether batch-07 audit reveals any in-flight feature plans that would resurrect this RPC. `cancel_payment_plan` was DONE-OK in batch 06 Phase 3 (Positive Pattern #1 + #4 + #8).
- **Cross-listed triggers**: 5 invoice_installments triggers + bump_invoice_pdf_rev_from_installments_ins/_upd/_del (3 STATEMENT-level pattern-consistent with payments-side) audited Phase 1 + Phase 4 batch 06. Class-consistency PASS.
- **CC-19 #11 schema constraint hygiene**: invoice_installments has `status` CHECK constraint ✓ (verified Phase 5 §5.4); no amount_minor positive CHECK (sibling to payments + payment_notifications gaps).
- **PI-15 PARTIALLY-RESOLVED batch-09 ownership**: batch-09 (term-continuation) owns the canonical credit-note creation surface; batch-07 is upstream of this only via installments-affecting-cancel paths (already covered by F-05-006 PI-06 closure at batch 05 invoice-overdue-check + cancel_payment_plan body Pattern #8).

**Pre-investigation queries for s46** (apply all 18 cumulative methodology lessons):
- `information_schema.tables` regex-match on installments-class table names BEFORE constructing IN-lists (s42 lessons)
- `pg_constraint contype='c'` for ALL column-constraint claims (s44 drift #11)
- **`pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'`** alongside `pg_constraint contype IN ('u','p')` (s45 drift #6 — NEW for s46)
- `pg_enum` for all enum value claims (s44 drift #8)
- RPC body filter values pulled via `pg_get_functiondef` BEFORE writing distribution queries (s44 drift #8)
- Column existence verification via `information_schema.columns` before assuming a status column or similar (s44 drift #7)
- Trigger event decoding via OR-able-bit CTE, NOT first-match CASE WHEN (s43 drift #4)
- TS-bypass-cast multi-pattern sweep with 4 sub-patterns (A/B/C/D) (s43 + s44 drifts; exclude JS comment lines)
- Bun → npm setup auto-detect (s43 drift #6)
- SECDEF body audit checklist: signature, search_path proconfig, EXECUTE grants, auth gating, body-level org membership check
- Cross-batch reach mapping for every RPC: which other-batch tables does the body read/write?
- Pattern catalog cross-reference: **23 positive patterns** post-s45; classify every observed RPC against the catalog
- **Filesystem-first edge fn enumeration** (s45 drift #4) — derive from `ls supabase/functions/` filtered by directory-name pattern
- **CENSUS owning-batch cross-check** (s45 drift #2) — launching prompt HEAD-pin-sensitive paths cite CENSUS row owning-batch verbatim
- **DB-verified count canonical** (s45 drift #5) — trigger / RPC / table counts come from live queries, not launching prompt arithmetic
- **Cumulative-tally projection methodology** (s45 drift #7) — project post-state cohort directly to avoid double-count arithmetic

Frame the s46 launching prompt with concrete file:line citations + DB evidence. No theory. Document evidence with `<file:line>` or `<db:query→result>` citations.

## 21. First action

Wait for the next user message. It will be CC's Phase 0 EXIT report for s46 batch 07-payment-plans-installments.

Verify in CC's Phase 0 EXIT:
- HEAD is at the s45 Phase 10 commit SHA (Jamie will provide this on session dispatch; capture and pin)
- Banner intact: AUDIT IN PROGRESS — DO NOT FIX YET on STATUS.md
- READ-FIRST list ingested (PLAN.md + STATUS.md + CENSUS.md sections for batch 07 + this handover snapshot + findings/06-payments-stripe-connect.md highlights)
- Tally on STATUS.md header reads 109 / 15 critical / 33 high / 23 medium / 38 low
- s46 prep summary present with batch-07 surface inventory + cross-batch carries from s45 + cumulative methodology lessons applied (18 drifts through s45)

Approve and prepare s46 Phase 1 paste-back per the 11-section contract. Phase 1 walks the batch-07 surface routes/pages/edge-fns/hooks with file:line citations.

Push back on any of the following if encountered:
- CC proposing to skip phases or merge phases
- Jamie proposing to fix or ship during audit
- Severity pre-tags carried through without rubric anchor citation
- Theory-based pre-investigation findings without file:line or DB evidence
- Migrations applied (`apply_migration` is forbidden during Phase B)
