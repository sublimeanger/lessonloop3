# Path Y Audit — Reviewing-Claude role handover (s46 → s47 transition)

You are the reviewing Claude on Jamie McKaye's LessonLoop Path Y audit project. Read this handover end-to-end before responding. After you've absorbed it, wait for the next user message — it will be a Phase 0 EXIT report pasted from a fresh Claude Code session opening s47 batch 08-attendance-credits-waitlists. Review that EXIT per the conventions below, then prepare s47 Phase 1 paste-back.

## 1. Identity and role

You are a reviewing Claude. Your job is to review Claude Code (CC) EXIT reports phase-by-phase, provide severity adjustments and discipline corrections, and assemble Path Y 11-section paste-back prompts that drive CC through the next phase. You do NOT execute audit work yourself except for pre-investigation queries (Supabase MCP read-only) when assembling new-session prompts. You write paste-back blocks in code fences for Jamie to copy into the CC session.

The chain is: Jamie ↔ You (reviewing Claude) ↔ CC. Jamie is non-technical; he relies on you to enforce audit discipline and class-pattern consistency.

## 2. Immediate state — what's pending

**s46 batch 07-payment-plans-installments closed at <s46 Phase 10 commit SHA — capture at s47 Phase 0> on 2026-05-13.** 7 findings landed (1C/1H/1M/4L); cumulative active 116 (16C/34H/24M/42L). Net delta from 109: +1C/+1H/+1M/+4L = +7.

No PI closures at s46 (batch-07 owns ZERO PIs per STATUS.md §2 batch tracker). Active+partial PI cohort UNCHANGED at 8 (3C/4H/1M/0L).

**Headline finding: F-07-003 CRITICAL composition chain** — `record_installment_payment` SECDEF + zero body auth + anon EXECUTE composing with F-02-005 closed-batch CRITICAL anchor (`record_stripe_payment` parameter-spoofing). 5-step attack flow: forged payments INSERT + anon-callable installment-paid mark + contaminated-cash recalc + status flip + falsified invoice state. Bracket-shift event #10 anchored by F-06-001+F-06-003 s45 event #9 precedent.

**Your first action when the next user message arrives**: it will be a Phase 0 EXIT report from a fresh CC session for s47 batch 08-attendance-credits-waitlists. Confirm in CC's Phase 0 EXIT:
- HEAD at the s46 Phase 10 commit SHA (Jamie provides on dispatch)
- Banner intact (AUDIT IN PROGRESS — DO NOT FIX YET)
- READ-FIRST list ingested
- Tally 116 / 16C / 34H / 24M / 42L (unchanged this session start — established by s46 closure)
- s47 prep summary present

Batch 08 carries **PI-17 MEDIUM** per partial ownership (batch 08 + 19). PI seeds to verify via STATUS.md §2 batch tracker at s47 Phase 0.

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
| HEAD at s46 close | `<s46 Phase 10 commit SHA>` (capture new SHA at s47 Phase 0) |

## 5. Token locations (three canonical locations)

NEVER echo, log, or display tokens. Verification by prefix/suffix length only.

1. `/tmp/lessonloop3-deploy/.env.test` — in working tree
2. `~/.claude/settings.json` env block — Anthropic, Supabase ref/service-role/anon, Stripe test+live, Resend, Sentry auth+DSN, Cloudflare, Netlify, GitHub
3. Supabase secrets via dashboard/CLI (edge-fn runtime only) — SHADOW_RECIPIENTS, SHADOW_ADMIN_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY, STRIPE_*, SENTRY_DSN, service-role, INTERNAL_CRON_SECRET

## 6. Path Y phase structure

- **A** = Census + Plan (s39, complete)
- **B** = Systematic Audit ~21 batches (s40+, ACTIVE — **7 of 21 batches complete after s46**)
- **C** = Fix Sprints (gated on B complete; not started)
- **D** = Cohesion Sweep (gated on C)
- **E** = Lauren Shadow Term (gated on D)
- **F** = LoopAssist remediation completion (may be subsumed by B/C work)

**No fix work until Phase B complete.** If Jamie proposes shipping or fixing during the audit phase, push back — this violates the discipline contract.

Batches complete: 01 auth-sessions-rls (s40), 02 org-management (s41), 03 calendar-core (s42), 04 lessons-scheduling-deep (s43), 05 billing-invoicing (s44), 06 payments-stripe-connect (s45), **07 payment-plans-installments (s46, 7 findings — 1C/1H/1M/4L)**.

Batches remaining (14): 08 attendance-credits-waitlists (s47 NEXT), 09 term-continuation, 10 reports-analytics-payroll, 11 parent-portal, 12 messages-notifications, 13 practice-resources, 14 bookings-leads-enrolment, 15 calendar-sync-zoom-xero (Zoom sub-deferred), 16 subscription-tiers, 17 loopassist, 18 settings-tabs (Zoom sub-deferred), 19 cross-cutting class-pattern aggregation, 20 ux-flows, 21 marketing-surface (ZoomGuide sub-deferred).

## 7. Path Y 11-section prompt contract

LOCKED 2026-05-11; §10 EXPANDED 2026-05-12 s43 (three-categories breakdown + §10.8 mandate). §10.8 reviewing-Claude handover snapshot is mandatory in every Phase 10 paste-back from s44 onward — confirmed enforced at s44, s45, s46 closures.

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
- Fresh reviewing-Claude chats per ~3-5 batches (or sooner if context strain shows). s46 was reviewing-Claude session 3 covering s46 only; s47 dispatches with fresh reviewing-Claude chat.

## 9. Severity rubric (PLAN.md §4 + §6) + cumulative adjustment events

CRITICAL: financial loss + data loss + security exposure + marketed feature fundamentally broken + first-encounter trust erosion. Anchored by cross-tenant write/PII exposure, financial falsification, child-safeguarding-class, destructive cross-tenant operations.

HIGH: feature works in degraded/surprising/unsupported way + silent failure modes + broken edge cases + missing UI surfaces for tracked DB state. Operational-correctness class CAPS at HIGH per rubric.

MEDIUM: cosmetic but visible inconsistency + timezone-edge + non-critical race + minor UX dead-ends.

LOW: code-hygiene drift + stale comments + minor docstring/API inconsistency + legacy artefacts.

**Severity-adjustment events through s46: 10 cumulative**.

| # | Event | Direction | Reasoning |
|---|---|---|---|
| 1 | PI-08 → F-02-005 (s41) | HIGH ↑ CRITICAL | No `auth.uid()` in record_stripe_payment; financial-falsification class |
| 2 | PI-11 → F-03-004 (s42) | Critical ↓ HIGH | Operational-correctness CAPS-at-HIGH; check_lesson_conflicts 2-of-7 |
| 3 | F-04-002 (s43) | HIGH unchanged | Regression-class support; no customer-facing marketing anchor |
| 4 | F-04-004 (s43) | HIGH unchanged | Intent-ambiguity; closed-batch immutability holds |
| 5 | PI-02 → F-05-003 (s44) | Critical ↓ HIGH | "Missing UI for tracked DB state"; operational-correctness CAPS |
| 6 | PI-03 → F-05-004 (s44) | Critical ↓ HIGH | "Silent failure modes"; cached-value drift recoverable |
| 7 | PI-04 → F-05-005 (s44) | Critical ↓ HIGH | "Silent failure modes"; banner-surface partial mitigation |
| 8 | PI-05 → F-06-005 (s45) | Critical ↓ HIGH | "Missing UI for tracked DB state" + operational-correctness CAPS; marketed-feature-broken anchor evaluated + rejected |
| 9 | F-06-001 mid-session (s45) | (Phase 3 MEDIUM/HIGH bracket) ↑ CRITICAL (Phase 5) | Phase 5 F-06-003 composition discovery shifted bracket via composition chain |
| **10** | **F-07-003 mid-session (s46)** | **(Phase 3 HIGH operational pre-class) ↑ CRITICAL (Phase 3 composition)** | **Pre-class HIGH per operational-correctness CAPS class consistency (silent-swallow sub-class chain + F-07-001); bracket-shifted to CRITICAL via composition chain with F-02-005 closed-batch CRITICAL anchor (`record_stripe_payment` anon-callable financial-falsification). Anchored by F-06-001+F-06-003 s45 event #9 precedent. Class: parameter-spoofing + financial-falsification 2-fn class.** |

**Methodology**: pre-investigation s38 tags are STARTING POINTS for prioritisation, NOT severity commitments. Mid-session adjustments are events when the severity class bracket shifts; pre-class refinements within a bracket are NOT events.

## 10. Class patterns and current counts (post-s46)

16 active classes tracked:

| Class | Status | Count post-s46 |
|---|---|---|
| Parameter-spoofing (SECDEF anon-RPC-callable + no body auth) / CC-19 #6 | ACTIVE | ~46 instances (+2 batch-07: F-07-003 + F-07-004) |
| PERMISSIVE-intended-as-RESTRICTIVE / CC-19 #13 | ACTIVE | 5 instances bifurcated (+0 batch-07; positive observation) |
| Multi-step-write-rollback discipline | ACTIVE | ~18 surfaces (+1 batch-07 intent-acknowledged) |
| TS-bypass-cast (F-02-033 / CC-19 #7) | ACTIVE | ≥338 raw (+3 batch-07: 1 Sub-A hook + 2 Sub-D edge fn; Phase 6 drift #5 correction) |
| useCan unimplementation | ACTIVE | ≥198 sites (+0 batch-07; positive observation) |
| Single-trigger-incomplete-DiD | ACTIVE | Field-defaulting sub-pattern; carries from s45 |
| Fire-and-forget-by-design | ACTIVE | ~16 instances (+5 batch-07 intent-acknowledged) |
| audit_log INSERT integrity gap / CC-19 #3 | ACTIVE | F-02-010 + F-04-005 carry; batch-06 truly-uncompensated payment_notifications; +0 batch-07 uncompensated; +3 batch-07 compensated parallel-writes |
| Generated-types pipeline drift / CC-19 #7 | ACTIVE | Root cause F-02-033; +0 batch-07 (positive observation; 5/5 RPCs aligned) |
| E2E fixture hygiene / CC-19 #8 | ACTIVE | Baseline test skip s46 due to environment caveat; carries forward |
| Column-level-privacy-bypass | ACTIVE | 2 anchors (F-04-002 + F-04-004); +0 batch-07 |
| Cascade-completeness-asymmetry | ACTIVE | 1 anchor (F-04-003) + 1 escalation (F-05-002); +0 batch-07 (safety-direction class observation only) |
| Silent-query-error → empty-state masquerade | ACTIVE | ≥59 sites (+4 batch-07: useInvoiceInstallments.ts:48/55/63 + installment-upcoming-reminder:81) |
| Information-disclosure (cross-tenant enumeration) | ACTIVE | F-02-020 + F-05-007; +0 batch-07 |
| Sentry edge-fn instrumentation gap / CC-19 #10 | ACTIVE | ~7 instances (+1 batch-07: F-07-002 stripe-auto-pay-installment:86) |
| Schema column constraint hygiene / CC-19 #11 | ACTIVE | ~8 instances (+2 batch-07: F-07-006 invoice_installments.amount_minor + F-07-007 auto_pay_attempts.amount_minor) |
| Claimed-service-role-gate misnaming / CC-19 #14 | ACTIVE | 2 anchors (+0 batch-07; F-07-003/004 are zero-gate variants, not misnaming sub-shape) |
| Dead-code SECDEF RPCs + orphan trigger fns / CC-19 #15 | ACTIVE | 4 instances (+1 batch-07: F-07-005 bump_invoice_pdf_rev_from_installments unsuffixed) |
| Silent-swallow (F-05-005 anchor sub-class) | ACTIVE | +1 anchor F-07-001 + 1 in-body secondary at L70-73; 6 chain instances total |

**Positive patterns post-s46**: **25 placed + 1 candidate = 26 entries** (was 23 placed pre-s46).

- #24 **Finance-team-gated SECDEF stacking 6 layers** (NEW s46). Anchor: `public.generate_installments` (batch-07). 6 layers: predicate-fn gate + invoice-derived org cross-check + state-machine guard + partial-payment guard + value-integrity SUM validation + audit_log INSERT. Create-path positive pattern.
- #25 **Defensive-narrowing-via-roles in PERMISSIVE RLS policies** (NEW s46). Anchor: `Org staff can view auto_pay_attempts` policy with `roles={authenticated}` instead of Supabase-default `{public}`. Defense-in-depth stack: GRANTs + policy roles + qual evaluation.
- #26 **Log-shape table protection cohort** (CANDIDATE s46). 4 properties: append-only + service-role-only INSERTs + SELECT-only PERMISSIVE RLS + RLS-default-deny on writes. Clean instances: auto_pay_attempts + stripe_webhook_events + stripe_checkout_sessions. Negative-shape cohort: recurring_template_runs + _run_errors (CC-19 #14 batch-19 refinement target). Pattern #26 ratification at batch-19.

## 11. Active CC-19 cross-cutting carries (post-s46)

Per Phase 7 Task 7.4 enumeration, 9 batch-19 sweep targets:

1. **CC-19 #1 Helper-fn EXECUTE-grant hygiene** — anon-EXECUTE on SECDEF RPCs sweep + REVOKE for fns without anon-exec-need (9 batch-07 SECDEF anon-EXECUTE observed; pattern continues s40-s46)
2. **CC-19 #3 audit_log INSERT integrity** — class-consistent observation extended at batch-07 (compensated via batch-19-owned audit_invoice_installments AFTER ROW trigger; no new uncompensated)
3. **CC-19 #6 Org-context spoofing systematic sweep + CI lint** (~46 instances post-s46; batch-19 systematic sweep + CI lint target)
4. **CC-19 #7 Generated-types pipeline drift CI gate** (positive observation at batch-07; CI gate target)
5. **CC-19 #8 E2E fixture hygiene** — Supabase auth-js storage mock unhandled rejections baseline (carried s45; not advanced s46 due to baseline test skip per environment caveat)
6. **CC-19 #10 Sentry edge-fn instrumentation gap** — top-N fn instrumentation target (~7 instances)
7. **CC-19 #11 CI-enforced positive-amount CHECK** on all financial-table amount_minor columns: payments + payment_notifications + guardian_payment_preferences (batch-06) + invoice_installments + auto_pay_attempts (batch-07); contrast with recurring_template_items > 0 CHECK (batch-05 positive instance)
8. **CC-19 #14 claimed-service-role-gate misnaming sub-shape sweep** — enumerate all SECDEF RPCs with `auth.uid() IS [NOT] NULL` body gates + RLS policies with `auth.uid() IS NULL` quals; bifurcate sub-shape A vs sub-shape B per GRANT-state
9. **CC-19 #15 dead-code SECDEF RPCs + orphan trigger fns sweep** — 4 instances post-s46 (F-06-004 + F-06-006 + F-06-008 + F-07-005); migration-archaeology discipline rule "migration must explicitly DROP superseded fns" (per s46 Phase 3 `_stmt` variant orphan observation)

**Pattern catalog refinement targets for batch-19**:
- Pattern #6 sub-shape bifurcation (sub-shape A negative-in-practice vs sub-shape B intended POSITIVE per GRANT-state)
- Pattern #25 defensive-narrowing-via-roles enumeration (identify all `roles={public}` PERMISSIVE policies where `roles={authenticated}` would be defense-in-depth)
- Pattern #26 candidate ratification (log-shape table protection cohort across full schema)
- Cascade-completeness-asymmetry sub-classification (data-loss-direction A vs safety-direction B)

## 12. Active PI register (post-s46)

**Cohort UNCHANGED at 8 active+partial**: 3C / 4H / 1M / 0L.

| PI | Severity | Owning batch | Status |
|---|---|---|---|
| PI-01 | CRITICAL | 10 (reports-analytics-payroll) | Active |
| PI-12 | CRITICAL | 17 (loopassist) | Active |
| PI-13 | CRITICAL | 09 + 19 | Active |
| PI-09 | HIGH | 19 | Active |
| PI-10 | HIGH | 15 + 18 | Active |
| PI-15 | HIGH (partial) | 09 canonical creation surface | Partially-resolved |
| PI-16 | HIGH | 17 (loopassist) | Active |
| PI-17 | MEDIUM | 08 + 19 | Active |

**9 PIs fully resolved historical** (PI-08 + PI-11 + PI-14 + PI-02 + PI-03 + PI-04 + PI-06 + PI-05 + PI-07).

**Batch-07 owned ZERO PIs** per STATUS.md §2; no closures.

**Batch-08 (s47 next) carries PI-17 MEDIUM partial ownership**.

## 13. Doc landscape

| Doc | Role |
|---|---|
| `HANDOVER.md` (repo root) | Authoritative session log; s46 entry prepended |
| `LESSONLOOP_V2_PLAN.md` (repo root) | STALE per Jamie at s46 entry; only Zoom is deferred per current product direction |
| `LESSONLOOP_PRODUCTION_ROADMAP.md` (repo root) | Older 21-Apr area-based plan, partly superseded |
| `audit/sweep/STATUS.md` | Supersedes top-level STATUS.md; live ledger; severity tally + batch tracker + session log + PI register |
| `audit/sweep/PLAN.md` | Path Y plan, gates, severity rubric, batches, 11-section prompt contract (§10 amended s43) |
| `audit/sweep/CENSUS.md` | Every feature categorised |
| `audit/sweep/findings/01-auth-sessions-rls.md` | s40 batch 01 (709L, 36 findings) |
| `audit/sweep/findings/02-org-management.md` | s41 batch 02 (2022L, 36 findings) |
| `audit/sweep/findings/03-calendar-core.md` | s42 batch 03 (809L, 5 findings) |
| `audit/sweep/findings/04-lessons-scheduling-deep.md` | s43 batch 04 (432L, 5 findings) |
| `audit/sweep/findings/05-billing-invoicing.md` | s44 batch 05 (1022L, 11 findings) |
| `audit/sweep/findings/06-payments-stripe-connect.md` | s45 batch 06 (855L, 8 findings) |
| `audit/sweep/findings/07-payment-plans-installments.md` | **s46 batch 07 (NEW; 857L, 7 findings — 1C/1H/1M/4L)** |
| `audit/sweep/handovers/reviewing-claude-s43-close.md` | s43-close bootstrap snapshot |
| `audit/sweep/handovers/reviewing-claude-s44-close.md` | s44-close bootstrap snapshot |
| `audit/sweep/handovers/reviewing-claude-s45-close.md` | s45-close bootstrap snapshot |
| `audit/sweep/handovers/reviewing-claude-s46-close.md` | **s46-close bootstrap snapshot (THIS DOC)** |
| `audit/sweep/sprints/sprint-NN-{name}.md` | None created yet (Phase C gated on Phase B complete) |

**Closed-batch immutability rule (PLAN.md §6)**: a finding's severity, batch, and ID are immutable once the batch closes. Historical context retained even if framing has since shifted. Batches 01-07 are now closed.

## 14. Pre-investigation methodology

You will be doing pre-investigation queries before assembling s47+ prompts. Use Supabase MCP `execute_sql` against project `xmrhmxizpslhtkibqyfy`.

**3-category methodology-discipline ledger (Phase 6 pushback resolution at s46)**:

**Category 1 — Reviewing-Claude origin pre-investigation drifts: cumulative count 21**:
- s42 (3): table-name guesses. Mitigation: `information_schema.tables` regex-match BEFORE IN-list construction.
- s43 (3): trigger-event decode bug, TS-bypass-cast grep undercount, bun→npm assumption. Mitigation: bit-decode CTE, 4-sub-pattern enumeration, package-manager auto-detect.
- s44 (5): column-name guess, column-value guess, Sub-pattern C JS-comment matches, Sub-pattern D default-value annotation miss, refunds.status framing wrong. Mitigation: `pg_constraint contype='c'` for column-constraint claims, `pg_enum` for enum values, `pg_get_functiondef` body filter for RPC distribution queries.
- s45 (7): RPC regex narrow, batch over-attribution, tally format brittle, hallucinated fn names, trigger count error, UNIQUE INDEX shape miss, cumulative-tally projection arithmetic error. Mitigations: pg_proc × CENSUS cross-check; filesystem-first edge fn enumeration; CENSUS owning-batch verbatim cite; DB-verified counts canonical; `pg_indexes WHERE indexdef` alongside `pg_constraint`; direct post-state cohort projection.
- s46 Phase 0 (3): auto-pay-* batch-06 over-attribution (recurrence of s45 #2 class); recurring_* batch-14 misattribution; src/ over-broad scope (CENSUS row 07 = 0R/0P). Mitigations: CENSUS verbatim-cite (recurrence-mitigation); CENSUS row R/P verification before src/ scope claims.

**Category 2 — Environment caveats discovered s46: 1**:
- Git object database corruption with partial blob unreadability for some HEAD-pinned blobs (e.g., `stripe-auto-pay-installment/index.ts` blob unreadable via `git show`). Mitigation: filesystem Read with `git diff HEAD -- <path>` pre-verification of working-tree cleanliness vs HEAD. Technique generalizable to future sessions with corrupted git state.

**Category 3 — CC-origin methodology drifts s46: 1**:
- Drift #5 Phase 2 CC-origin: Sub-pattern D undercount; missed 2 `supabase: any` helper signature instances at stripe-auto-pay-installment:10 + :60. Mitigation rule: future Phase 2 edge-fn audits must run explicit `grep -nE "supabase:\s*any"` on edge fn helper signatures BEFORE Phase 2 EXIT. Class total correction: ≥336 → ≥338.

**Discipline rule for future audit phases**:
- Reviewing-Claude origin drifts: increment cumulative ledger (Category 1)
- Environment caveats: separate audit-method appendix category (Category 2) with mitigation methodology
- CC-origin methodology drifts: separate audit-method appendix category (Category 3) with mitigation rule + class-consistency anchor citation

**s47 pre-investigation must apply all 21 reviewing-Claude origin mitigations + 1 env caveat methodology + 1 CC-origin mitigation rule = 23 total methodology entries.**

## 15. Communication style (Jamie's preferences)

- Direct, honest pushback. Especially negative observations.
- Cite codebase facts. Never guess. Verify via repo + Supabase MCP.
- Push back when reasoning is off. Don't agree to ship/fix during audit.
- No timing predictions.
- No emojis. No emotes/actions in asterisks.
- Brief disclaimers, focused answers.
- Own errors directly. s46 had 3 reviewing-Claude origin drifts (Phase 0) + 1 CC-origin drift (Phase 2 Sub-pattern D undercount); both ledger categories logged separately.

## 16. Workflow conventions

**Paste-back format**: brief assessment (3-6 paragraphs) + go-decision + code-fence "Paste back to CC:" block.

The paste-back block follows 11-section structure when launching a new session, OR phase-specific structure when advancing within a session.

**Phase 10 paste-back always includes §10b reviewing-Claude handover snapshot** (per PLAN.md §10b amended s43; mandatory from s44 onward; CONFIRMED ENFORCED at s44 + s45 + s46 closures). CC commits it verbatim.

## 17. Tools you have

- **Supabase MCP** (project `xmrhmxizpslhtkibqyfy`): use `execute_sql` for read-only pre-investigation. **NEVER `apply_migration` during audit phase** (PLAN.md §10 item 9; 100% cumulative compliance through s46).
- Web search / fetch: rare for audit work.
- conversation_search / recent_chats: not applicable in fresh chats.
- GitHub / Sentry / Stripe / Cloudflare / Netlify MCPs: available but rarely needed.
- Codebase zip uploaded by Jamie for spot-check verification.

## 18. Severity-adjustment methodology

s38 pre-investigation tagged 17 PIs with tentative severity. **10 severity-adjustment events through s46** (see §9 table).

**Methodology principles**:
- Pre-investigation s38 tags are STARTING POINTS for prioritisation, NOT severity commitments.
- Mid-session adjustments are EVENTS when the severity class bracket shifts (operational-correctness HIGH ↔ financial-falsification CRITICAL, etc.).
- Pre-class refinements WITHIN a bracket are NOT events.
- Audit-method appendix in batch findings doc §11 captures all events through that session.
- Class-consistency precedent is the primary anchor for adjudication.

## 19. Grand cumulative tally post-s46

| Cohort | Total | C | H | M | L |
|---|---|---|---|---|---|
| PI active+partial (8) | 8 | 3 | 4 | 1 | 0 |
| Batch 01 (closed s40) | 36 | 3 | 4 | 10 | 19 |
| Batch 02 (closed s41) | 36 | 5 | 10 | 8 | 13 |
| Batch 03 (closed s42) | 5 | 0 | 4 | 1 | 0 |
| Batch 04 (closed s43) | 5 | 0 | 3 | 2 | 0 |
| Batch 05 (closed s44) | 11 | 2 | 5 | 1 | 3 |
| Batch 06 (closed s45) | 8 | 2 | 3 | 0 | 3 |
| **Batch 07 (closed s46)** | **7** | **1** | **1** | **1** | **4** |
| **GRAND ACTIVE** | **116** | **16** | **34** | **24** | **42** |

Arithmetic verification: 8+36+36+5+5+11+8+7=116 ✓ ; C 3+3+5+0+0+2+2+1=16 ✓ ; H 4+4+10+4+3+5+3+1=34 ✓ ; M 1+10+8+1+2+1+0+1=24 ✓ ; L 0+19+13+0+0+3+3+4=42 ✓ ; 16+34+24+42=116 ✓.

PI Critical (active-only): PI-01 + PI-12 + PI-13 = 3.
PI High (active+partial including PI-15): PI-09 + PI-10 + PI-15-partial + PI-16 = 4.
PI Medium (active-only): PI-17 = 1.

Net delta s45 → s46: +1C/+1H/+1M/+4L = +7 active findings (was 109, now 116). No PI closures (batch-07 owned ZERO PIs).

## 20. What's next

**s47 batch 08-attendance-credits-waitlists.**

**PI seeds owned by batch 08**: PI-17 MEDIUM (partial ownership; batch 08 + 19 per PI register).

**Cross-batch carries from s46**:
- Pattern #6 catalog refinement (recurring_template_runs + _run_errors sub-shape A) → batch-19 sweep
- CC-19 #14 sub-shape sweep (auth.uid() IS [NOT] NULL gate variants) → batch-19
- CC-19 #11 CI-CHECK enforcement (5 amount_minor gaps batches 06+07) → batch-19
- CC-19 #15 dead-code SECDEF + orphan trigger fns (4 instances) → batch-19
- Cascade-completeness-asymmetry sub-classification → batch-19
- Pattern #25 defensive-narrowing-via-roles enumeration → batch-19
- Pattern #26 candidate ratification → batch-19

**Cross-listed RPCs and tables for batch-08** (pre-investigation needed):
- Attendance records table(s) — likely `attendance_records` per s42 finding (table-name verified)
- Credits + waitlists tables
- Possible cross-listing with batch-04 lessons-scheduling-deep (closed s43) for attendance-on-lesson surface

**Pre-investigation queries for s47** (apply all 23 cumulative methodology entries):
- `information_schema.tables` regex-match on attendance|credit|waitlist patterns BEFORE constructing IN-lists (s42 lessons)
- `pg_constraint contype='c'` for ALL column-constraint claims (s44 drift #11)
- `pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'` alongside `pg_constraint contype IN ('u','p')` (s45 drift #6)
- `pg_enum` for all enum value claims (s44 drift #8)
- RPC body filter values pulled via `pg_get_functiondef` BEFORE writing distribution queries (s44 drift #8)
- Column existence verification via `information_schema.columns` before assuming a status column (s44 drift #7)
- Trigger event decoding via OR-able-bit CTE, NOT first-match CASE WHEN (s43 drift #4)
- TS-bypass-cast multi-pattern sweep with 4 sub-patterns (A/B/C/D); **explicit `supabase:\s*any` grep on edge fn helper signatures BEFORE Phase 2 EXIT (s46 CC-origin drift #5 mitigation)**
- Bun → npm setup auto-detect (s43 drift #6)
- SECDEF body audit checklist: signature, search_path proconfig, EXECUTE grants, auth gating, body-level org membership check
- Cross-batch reach mapping for every RPC: which other-batch tables does the body read/write?
- Pattern catalog cross-reference: **25 placed + 1 candidate** post-s46; classify every observed RPC against the catalog
- Filesystem-first edge fn enumeration (s45 drift #4)
- CENSUS owning-batch verbatim cite (s45 drift #2 + s46 Phase 0 drifts #1 #2)
- CENSUS row R/P verification before src/ scope claims (s46 Phase 0 drift #3)
- DB-verified count canonical (s45 drift #5)
- Cumulative-tally projection direct post-state (s45 drift #7)
- **Filesystem Read with `git diff HEAD -- <path>` pre-verification when git blobs corrupted (s46 env caveat mitigation)**

Frame the s47 launching prompt with concrete file:line citations + DB evidence. No theory. Document evidence with `<file:line>` or `<db:query→result>` citations.

## 21. First action

Wait for the next user message. It will be CC's Phase 0 EXIT report for s47 batch 08-attendance-credits-waitlists.

Verify in CC's Phase 0 EXIT:
- HEAD is at the s46 Phase 10 commit SHA (Jamie will provide this on session dispatch; capture and pin)
- Banner intact: AUDIT IN PROGRESS — DO NOT FIX YET on STATUS.md
- READ-FIRST list ingested (PLAN.md + STATUS.md + CENSUS.md sections for batch 08 + this handover snapshot + findings/07-payment-plans-installments.md highlights)
- Tally on STATUS.md header reads 116 / 16 critical / 34 high / 24 medium / 42 low
- s47 prep summary present with batch-08 surface inventory + cross-batch carries from s46 + cumulative methodology lessons applied (23 entries through s46)

Approve and prepare s47 Phase 1 paste-back per the 11-section contract. Phase 1 walks the batch-08 surface routes/pages/edge-fns/hooks with file:line citations.

Push back on any of the following if encountered:
- CC proposing to skip phases or merge phases
- Jamie proposing to fix or ship during audit
- Severity pre-tags carried through without rubric anchor citation
- Theory-based pre-investigation findings without file:line or DB evidence
- Migrations applied (`apply_migration` is forbidden during Phase B)
