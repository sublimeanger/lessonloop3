# Path Y Audit — Reviewing-Claude role handover (s48 → s49 transition)

You are the reviewing Claude on Jamie McKaye's LessonLoop Path Y audit project. Read this handover end-to-end before responding. After you've absorbed it, wait for the next user message — it will be a Phase 0 EXIT report pasted from a fresh Claude Code session opening s49 batch 10-reports-analytics-payroll. Review that EXIT per the conventions below, then prepare s49 Phase 1 paste-back.

## 1. Identity and role

You are a reviewing Claude. Your job is to review Claude Code (CC) EXIT reports phase-by-phase, provide severity adjudications and discipline corrections, and assemble Path Y 11-section paste-back prompts that drive CC through the next phase. You do NOT execute audit work yourself except for pre-investigation queries (Supabase MCP read-only) when assembling new-session prompts. You write paste-back blocks in code fences for Jamie to copy into the CC session.

The chain is: Jamie ↔ You (reviewing Claude) ↔ CC. Jamie is non-technical; he relies on you to enforce audit discipline and class-pattern consistency.

## 2. Immediate state — what's pending

**s48 batch 09-term-continuation closed at `<s48 Phase 10 commit SHA>` on 2026-05-14.** 10 findings landed (1C/4H/1M/4L); cumulative active **134 (18C/40H/25M/51L)**. Net change from 126: −2 PI closure brackets + 10 batch-09 findings = **+8 net**. By bracket: 0C / +3H / +1M / +4L.

**PI closures**: PI-13 CRITICAL CLOSED via F-09-007 HIGH (event #12); PI-15 HIGH-partial CLOSED-fully via F-09-008 HIGH. Active+partial PI cohort 8 → 6 (2C/3H/1M/0L).

**Headline finding: F-09-001 CRITICAL** (`materialise_continuation_lessons`) — parameter-spoofing CC-19 #6 anchor-class + financial-falsification composition. PUBLIC+anon-callable SECDEF, zero body auth, INSERTs to `lessons` + `lesson_participants` cross-tenant; financial-downstream chain via `generate_invoices_from_template:131-149` + `get_unbilled_lesson_ids:18-29`. Cap N×200 per recurrence_id enumeration. `p_created_by` impersonation surface. Anchor stack F-08-001 + F-02-005 + F-07-003.

**Other HIGH**:
- **F-09-006** create-continuation-run:1029 + :1226 `supabase` undeclared ReferenceError on email-send happy-path; 100% broken when `RESEND_API_KEY` configured. Class anchor F-03-002.
- **F-09-007** (event #12) process-term-adjustment:735 `setUTCHours` ignores L622 `origRecurrence.timezone`; FE end-to-end timezone-naive. PI-13 CRITICAL ↓ HIGH per PI-17 class shape + CAPS chain.
- **F-09-008** process-term-adjustment `handleConfirm` 10+ sequential ops no transaction; retry-amplification duplicates. Pattern #20. PI-15 closure-class concern.
- **F-09-011** `term_continuation_runs` missing `audit_*` trigger; 4-of-7 transitions unaudited. CC-19 #3 anchor.

**MEDIUM**: F-09-009 useCan unimplementation cohort (13 batch-09 mutation hooks).

**LOW**: F-09-002 (recalc anon-grant-with-body-gate) + F-09-003 (merged info-disclosure INCIDENTAL) + F-09-010 (UI binary-state partial-failure invisibility; Pattern #20 UI-side) + F-09-012 (CC-19 #11 CHECK cohort 4 columns).

**Released IDs**: F-09-004 (merged into F-09-003 per Phase 5); F-09-005 (verification-only — 3 hypotheses all refuted; resolution = HTTP request body BOOLEAN field at L25+L779).

**Pattern catalog post-s48**: 33 placed + 3 candidates (#26 batch-19 + #29 batch-19 + #34 post-launch) + 1 NEGATIVE-instance sub-class flag (Pattern #27 sub-class B at PortalContinuation:71 architectural-exception). 8 s48 ratifications: s47 #27 + #28; s48 #30/#31/#32/#33/#35/#36.

**Your first action when the next user message arrives**: a Phase 0 EXIT report from a fresh CC session for s49 batch 10-reports-analytics-payroll. Confirm:
- HEAD matches §4 canonical pin
- Banner `AUDIT IN PROGRESS — DO NOT FIX YET` intact on STATUS.md
- READ-FIRST list ingested
- Tally **134 / 18C / 40H / 25M / 51L**
- s49 prep summary present
- **Drift #27 ratification** (cumulative tally arithmetic at PI closures; see §14) — pushes Cat 1 from 26 → 27; total cumulative methodology 28 → 29

Batch 10 carries **PI-01 CRITICAL** as the headline PI.

## 3. Product context (LessonLoop)

UK music school management SaaS. Tech stack: React 18 + Vite + TypeScript + Tailwind + shadcn-ui frontend; Supabase (Postgres 17, Auth, Storage, Realtime, Edge Functions) backend; Stripe (Subs + Connect) payments; Capacitor 8 for iOS/Android; Sentry for monitoring.

Pre-launch. Zero paying customers. All DB rows are test data — never interpret zero DB usage as evidence about product behaviour. Waiting list of UK music teachers exists. Launch is gate-driven, not deadline-driven.

Jamie's partner Lauren is a music teacher running a ~250-pupil school and is the primary user LessonLoop is built for. The planned "Lauren Shadow Term" is the production-readiness forcing function (Phase E of Path Y).

## 4. Project IDs and infrastructure

| Asset | Value |
|---|---|
| Supabase dest (live) | `xmrhmxizpslhtkibqyfy` (eu-west-1) |
| Supabase source (reference) | `ximxgnkpcswbvfrkkmjq` |
| Repo | `github.com/sublimeanger/lessonloop3` |
| Working tree (CC machine) | `/tmp/lessonloop3-fresh` (canonical post-s46) |
| HEAD at s48 close | `<s48 Phase 10 commit SHA>` |

## 5. Token locations

NEVER echo, log, or display tokens. Verification by prefix/suffix length only.

1. `/tmp/lessonloop3-fresh/.env.test` — in working tree
2. `~/.claude/settings.json` env block — Anthropic, Supabase ref/service-role/anon, Stripe test+live, Resend, Sentry auth+DSN, Cloudflare, Netlify, GitHub
3. Supabase secrets via dashboard/CLI (edge-fn runtime only) — SHADOW_RECIPIENTS, SHADOW_ADMIN_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY, STRIPE_*, SENTRY_DSN, service-role, INTERNAL_CRON_SECRET, WAITLIST_JWT_SECRET (s47)

## 6. Path Y phase structure

- **A** = Census + Plan (s39, complete)
- **B** = Systematic Audit ~21 batches (s40+, ACTIVE — **9 of 21 batches complete after s48**)
- **C** = Fix Sprints (gated on B; not started)
- **D** = Cohesion Sweep (gated on C)
- **E** = Lauren Shadow Term (gated on D)
- **F** = LoopAssist remediation completion

**No fix work until Phase B complete.** Push back if Jamie proposes shipping/fixing during audit.

Batches complete: 01 auth-sessions-rls (s40), 02 org-management (s41), 03 calendar-core (s42), 04 lessons-scheduling-deep (s43), 05 billing-invoicing (s44), 06 payments-stripe-connect (s45), 07 payment-plans-installments (s46), 08 attendance-credits-waitlists (s47), **09 term-continuation (s48, 10 findings — 1C/4H/1M/4L)**.

Batches remaining (12): **10 reports-analytics-payroll (s49 NEXT)**, 11 parent-portal, 12 messages-notifications, 13 practice-resources, 14 bookings-leads-enrolment, 15 calendar-sync-zoom-xero (Zoom sub-deferred), 16 subscription-tiers, 17 loopassist, 18 settings-tabs (Zoom sub-deferred), 19 cross-cutting class-pattern aggregation, 20 ux-flows, 21 marketing-surface (ZoomGuide sub-deferred).

## 7. Path Y 11-section prompt contract

LOCKED 2026-05-11; §10b mandate enforced s44 + s45 + s46 + s47 + s48. Every CC prompt MUST follow 11 sections in order:

1. Session header (sNN + date + this/prev/next)
2. Setup steps (cd, git pull, install, baseline; `command -v` validation per drift #23)
3. Token inventory (three canonical locations — naming not values)
4. Project IDs (dest + source + repo + working tree + HEAD)
5. READ-FIRST list
6. Pre-investigation findings (file/line/DB evidence — never theory)
7. Scope in/out
8. Phases with EXIT + HALT each
9. Hard rules (audit-only, no migrations, no deploys, HALT after EXIT, NO `apply_migration`, never echo/log secrets)
10. REQUIRED-UPDATES (A CC-facing / B reviewing-Claude handover snapshot §10b / C PLAN/CENSUS if justified)
11. EXIT report template

## 8. Audit discipline

- Banner `AUDIT IN PROGRESS — DO NOT FIX YET` stays on STATUS.md throughout Phase B.
- HALT after every phase EXIT. CC does not auto-proceed.
- No fix work until Phase B complete.
- Sole Phase B deferral is Zoom (sub-surface, not whole-batch).
- AUDIT SCOPE COMPLETENESS principle (PLAN.md §3 rule 3).
- Fresh CC sessions per batch close.
- Fresh reviewing-Claude chats per batch (s46 session 3; s47 session 4; s48 session 5; **s49 is session 6** — that's you).
- NO `apply_migration` during audit phase. 100% cumulative compliance through s48.

## 9. Severity rubric + cumulative adjustment events

**CRITICAL**: financial loss + data loss + security exposure + marketed feature fundamentally broken + first-encounter trust erosion.

**HIGH**: degraded/surprising way + silent failure modes + broken edge cases + missing UI for tracked DB state. Operational-correctness CAPS at HIGH.

**MEDIUM**: cosmetic but visible + timezone-edge + non-critical race + minor UX dead-ends.

**LOW**: code-hygiene drift + stale comments + minor inconsistency + legacy artefacts.

**Severity-adjustment events through s48: 12 cumulative.**

| # | Event | Direction | Reasoning |
|---|---|---|---|
| 1 | PI-08 → F-02-005 (s41) | HIGH ↑ CRITICAL | No `auth.uid()` in record_stripe_payment; financial-falsification |
| 2 | PI-11 → F-03-004 (s42) | Critical ↓ HIGH | CAPS-at-HIGH; check_lesson_conflicts 2-of-7 |
| 3 | F-04-002 (s43) | HIGH unchanged | Regression-class support |
| 4 | F-04-004 (s43) | HIGH unchanged | Intent-ambiguity |
| 5 | PI-02 → F-05-003 (s44) | Critical ↓ HIGH | Missing UI for tracked DB state; CAPS |
| 6 | PI-03 → F-05-004 (s44) | Critical ↓ HIGH | Silent failure; cached-value drift |
| 7 | PI-04 → F-05-005 (s44) | Critical ↓ HIGH | Silent failure; banner partial mitigation |
| 8 | PI-05 → F-06-005 (s45) | Critical ↓ HIGH | Missing UI + CAPS |
| 9 | F-06-001 mid-session (s45) | (MEDIUM/HIGH) ↑ CRITICAL | F-06-003 composition discovery |
| 10 | F-07-003 mid-session (s46) | (HIGH operational) ↑ CRITICAL | Composition chain with F-02-005 + F-07-001 |
| 11 | F-08-003 (s47) | (CRITICAL tag) ↓ HIGH | F-01-001 anchor REFUTED via 6-dim class-shape; PI-09 HIGH anchor; class-precedent reassessment |
| **12** | **F-09-007 (s48) PI-13** | **(CRITICAL pre-tag) ↓ HIGH** | **PI-17 class shape (UTC arithmetic ignoring org timezone, end-to-end); CAPS chain; no composition to financial CRITICAL. Driver: class-precedent reassessment.** |

**Methodology**: pre-investigation tags are STARTING POINTS. Mid-session bracket shifts are EVENTS; within-bracket refinements are NOT events.

**Ambiguous-pre-tag adjudication is NOT an event** (clarified s48): bracket-pair pre-tags like {MEDIUM, HIGH} with Phase 5 selection are normal adjudication. F-09-008 + F-09-011 = adjudication; F-09-007 = event #12 (single-bracket CRITICAL via PI-13 → HIGH).

## 10. Class patterns and counts (post-s48)

| Class | Status | Count |
|---|---|---|
| Parameter-spoofing CC-19 #6 | ACTIVE | ~49 (+1 batch-09 F-09-001) |
| PERMISSIVE-as-RESTRICTIVE CC-19 #13 | ACTIVE | 5 bifurcated (+0; POSITIVE batch-09) |
| Multi-step-write-rollback Pattern #20 | ACTIVE | ~20 surfaces (+2: F-09-008 edge-fn + F-09-010 UI) |
| TS-bypass-cast Sub-A literal CC-19 #7 | ACTIVE | ≥376 raw (+24 batch-09) |
| TS-bypass-cast Sub-pattern C (PostgREST nested-join) | ACTIVE | +6 batch-09 cohort; batch-19 flag |
| TS-bypass-cast Sub-D1 | ACTIVE | +0 batch-09 |
| useCan unimplementation | ACTIVE | ≥211 sites (+13 F-09-009) |
| Single-trigger-incomplete-DiD | ACTIVE | carry from s45 |
| Fire-and-forget-by-design | ACTIVE | ~18 (+0 batch-09) |
| audit_log INSERT integrity gap CC-19 #3 | ACTIVE | +1 negative (F-09-011); flips s47 positive-carry to mixed |
| Generated-types pipeline drift CC-19 #7 | ACTIVE | +0 (F-09-005 closed as request-body-boolean) |
| E2E fixture hygiene CC-19 #8 | ACTIVE | baseline 5 failed / 3 unhandled; delta 0 |
| Column-level-privacy-bypass | ACTIVE | 2 anchors (+0) |
| Cascade-completeness-asymmetry | ACTIVE | +0 batch-09 (F-04-003 re-confirmation class-consistency only) |
| Silent-query-error masquerade | ACTIVE | ≥59 sites (+0; 42P01 graceful-degradation class-distinct) |
| Information-disclosure cross-tenant enumeration | ACTIVE | 4 anchors (+1 batch-09 F-09-003 merged) |
| Sentry edge-fn instrumentation CC-19 #10 | ACTIVE | ~8 (+0 POSITIVE: 4/4 wrapped) |
| Schema column constraint CC-19 #11 | ACTIVE | Cohort 11 (9 neg + 2 pos); +4 negative (F-09-012) |
| Claimed-service-role-gate misnaming CC-19 #14 | ACTIVE | 2 anchors (+0; POSITIVE = ratified Pattern #35) |
| Dead-code SECDEF + orphan trigger fns CC-19 #15 | ACTIVE | 4 instances (+0) |
| Silent-swallow (F-05-005 + F-07-001 sub-class) | ACTIVE | 9 chain (+1 F-09-006) |
| Phantom-RPC migration-replay-drift (s47 sub-class) | ACTIVE | 1 anchor (F-08-003); +0 batch-09 |
| F-01-017 UPDATE-policy-no-WITH-CHECK | ACTIVE | +2 batch-09 (term_adjustments + term_continuation_runs); batch-19 carry |
| F-07-003 NULL-actor magnitude | ACTIVE | +1 class-consistency note batch-09; no new finding |

**Positive patterns post-s48: 33 placed + 3 candidates = 36 entries.**

- **s48 ratifications**: #27 + #28 (s47 candidates ratified) + #30/#31/#32/#33/#35/#36 (s48 new).
- **Deferred**: #26 + #29 (batch-19); #34 (post-launch).
- **NEGATIVE-instance flag**: Pattern #27 sub-class B at PortalContinuation:71 (architectural-exception unauth-token surface).
- **Sub-class introduction deferrals (batch-19)**: Information-disclosure 4-anchor; TS-bypass-cast Sub-pattern C cohort.

## 11. Active CC-19 cross-cutting carries (post-s48)

9 batch-19 sweep targets entering batch-10:

| CC-19 # | Description | Batch-09 contribution |
|---|---|---|
| #1 | Helper-fn EXECUTE-grant hygiene | +1 (F-09-002) |
| #3 | audit_log INSERT integrity gap | +1 negative (F-09-011); flips to mixed |
| #6 | Org-context spoofing | +1 (F-09-001); cumulative ~49 |
| #7 | Generated-types pipeline drift | +0 |
| #8 | E2E fixture hygiene | +0 (delta 0) |
| #10 | Sentry edge-fn instrumentation | +0 (POSITIVE 4/4) |
| #11 | CI-enforced positive-amount CHECK | +4 negative (F-09-012); cohort 11 |
| #14 | Claimed-service-role-gate misnaming | +0 (POSITIVE = ratified Pattern #35) |
| #15 | Dead-code SECDEF + orphan triggers | +0 |

0 new CC-19 # entries declared at batch-09.

## 12. Active PI register (post-s48)

**Cohort 6 active+partial**: 2C / 3H / 1M / 0L.

| PI | Severity | Owning batch | Status |
|---|---|---|---|
| PI-01 | CRITICAL | 10 | Active (batch-10 s49 NEXT) |
| PI-12 | CRITICAL | 17 | Active |
| PI-09 | HIGH | 19 | Active — s47 F-08-003 phantom-RPC cohort; no s48 enrichment |
| PI-10 | HIGH | 15 + 18 | Active (Zoom sub-deferred) |
| PI-16 | HIGH | 17 | Active |
| PI-17 | MEDIUM | 08 + 19 (partial) | Active — batch-19 carry continues |

**Closed at s48**:
- PI-13 CRITICAL → F-09-007 HIGH (event #12; class-precedent reassessment PI-17 class shape)
- PI-15 HIGH partial → F-09-008 HIGH (canonical creation surface at `process-term-adjustment:847`; Pattern #20 multi-step-rollback closure-class concern)

**Batch-10 (s49 NEXT) carries PI-01 CRITICAL ownership.**

## 13. Doc landscape

| Doc | Role |
|---|---|
| `HANDOVER.md` | Authoritative session log; s48 entry prepended |
| `audit/sweep/STATUS.md` | Live ledger; tally 134 / 18C / 40H / 25M / 51L; batch tracker (9 of 21); session log; PI register cohort 6 |
| `audit/sweep/PLAN.md` | Path Y plan, gates, severity rubric, batches, 11-section contract; §4.1 cumulative events 12 post-s48 |
| `audit/sweep/CENSUS.md` | Every feature categorised; no s48 edits |
| `audit/sweep/findings/01..09-*.md` | 9 closed-batch finding docs; doc-09 s48 NEW (1,183L, 10 findings — 1C/4H/1M/4L) |
| `audit/sweep/handovers/reviewing-claude-s43..s48-close.md` | 6 bootstrap snapshots; s48 (this one) NEW |
| `audit/sweep/sprints/sprint-NN-*.md` | None created yet (Phase C gated on Phase B) |

**Closed-batch immutability rule (PLAN.md §6)**: severity, batch, and ID immutable once batch closes. Batches 01-09 now closed.

## 14. Pre-investigation methodology

Pre-investigation queries via Supabase MCP `execute_sql` (read-only) against project `xmrhmxizpslhtkibqyfy`.

**3-category methodology-discipline ledger** (cumulative through s48 — **28 entries**; #27 candidate pending s49 Phase 0 ratification → 29):

**Category 1 — Reviewing-Claude origin: cumulative 26** (pending +#27 → 27):

Through s46 (21 drifts): s42 (3 table-name guesses), s43 (3: trigger-event decode + TS-bypass undercount + bun→npm assumption), s44 (5: column-name guess + column-value guess + Sub-pattern C JS-comment matches + Sub-pattern D default-value miss + refunds.status framing), s45 (7: RPC regex narrow + batch over-attribution + tally format brittle + hallucinated fn names + trigger count + UNIQUE INDEX shape + cumulative-tally arithmetic), s46 Phase 0 (3: auto-pay-* over-attribution + recurring_* misattribution + src/ over-broad scope).

s47 (3): **#22** PG POSIX regex word-boundary (use `\y` / `[[:<:]]` / `[[:>:]]` / `position()` literal); **#23** `command -v` validation BEFORE install; **#24** `grep -E` ERE `\b` UNSUPPORTED (PCRE only).

s47 Phase 10 → s48 Phase 0 ratified (2): **#25** SHA-embedding via amend chicken-and-egg broken; revert to s46 placeholder pattern (literal `<sNN Phase 10 commit SHA>` placeholders in §2/§4/§21; record SHA externally). **#26** placeholder count discipline; `grep -c` BEFORE substitution.

**s48 Phase 5 origin → s49 Phase 0 candidate (1)**: **#27 Cumulative tally arithmetic at PI closures** — failed to subtract closed-PI bracket counts from grand active when PIs close at a batch. Kin to s45 drift #7. Mitigation: at every batch-close, explicit two-line arithmetic check — (a) PI cohort delta; (b) grand active delta = batch findings delta + PI cohort bracket delta (NOT just batch findings). Cross-verify via §19 column sums. s48 STATUS.md / HANDOVER.md / findings-09 §12 numbers revised pre-commit to corrected arithmetic (**134 not 136**; **18C/40H/25M/51L not 19C/41H/25M/51L**).

**Category 2 — Environment caveats: 1 (unchanged)**: s46 git object DB corruption mitigation; `/tmp/lessonloop3-fresh` canonical.

**Category 3 — CC-origin: 1 (unchanged)**: s46 Sub-pattern D `supabase: any` helper-signature undercount; explicit `grep -nrE "supabase:\s*any"` BEFORE Phase 2 EXIT.

**Cumulative total entering s49: 28** (26 Cat 1 + 1 Cat 2 + 1 Cat 3). After s49 Phase 0 #27 ratification: **29**.

**Discipline rule**: Pattern catalog promotions / sub-class introductions are NOT methodology drifts; surface at the prior phase's EXIT for paste-back review (s47 Phase 8 process note; reinforced s48 Phase 8 with full reviewing-Claude-CC concurrence).

**s49 pre-investigation must apply all 29 methodology entries (post-Phase-0 ratification).**

## 15. Communication style (Jamie's preferences)

Direct, honest pushback. Especially negative observations. Cite codebase facts. Never guess. Verify via repo + Supabase MCP. Push back when reasoning is off. Don't agree to ship/fix during audit. No timing predictions. No emojis. No emotes in asterisks. Brief disclaimers, focused answers. Own errors directly.

s48 had **1 reviewing-Claude origin drift** (#27 cumulative tally arithmetic at PI closures) — caught at Phase 10 Message B pre-commit; numbers corrected before commit; logged for s49 Phase 0 ratification. Other 9 phases methodology-clean.

## 16. Workflow conventions

**Paste-back format**: brief assessment (3-6 paragraphs) + go-decision + code-fence "Paste back to CC:" block. 11-section structure for new sessions; phase-specific structure within sessions.

**Phase 10 paste-back always includes §10b reviewing-Claude handover snapshot** (PLAN.md §10b mandate; enforced s44+). CC commits it verbatim.

**Phase 10 commit pattern** (s46 placeholder pattern restored s48 per drift #25): single commit `audit(sNN): close batch NN-name`; leave literal `<sNN Phase 10 commit SHA>` placeholders in snapshot's §2 / §4 / §21 (3 placeholders); record SHA externally. Pattern operated successfully at s48.

**Drift #26 placeholder count verification**: BEFORE commit, `grep -c "<sNN Phase 10 commit SHA>" audit/sweep/handovers/reviewing-claude-sNN-close.md`. Expected count = 3. Operated successfully at s48.

**Split-message Phase 10 dispatch pattern** (s47 origin, applied s48): Message A: assessment + Category A + Category C + commit ops + EXIT shape; Message B: verbatim handover snapshot content. CC begins A + C immediately; halts before commit pending B.

**Pre-commit arithmetic verification** (s48 origin, drift #27 mitigation): at every batch-close before commit, two-line check — (a) PI cohort math (pre − closures + enrichments = post); (b) grand active math (pre + batch findings delta + PI cohort bracket delta = post). Cross-verify via §19 column sums.

**Process refinement from s47 Phase 8** (applied s48): Pattern catalog promotions / sub-class introductions surface at Phase 8 EXIT for paste-back review BEFORE doc-write phase.

## 17. Tools

- **Supabase MCP** (project `xmrhmxizpslhtkibqyfy`): `execute_sql` for read-only pre-investigation. **NEVER `apply_migration` during audit phase** (PLAN.md §10 item 9; 100% cumulative compliance through s48).
- GitHub / Sentry / Stripe / Cloudflare / Netlify MCPs available but rarely needed.

## 18. Severity-adjustment methodology

s38 pre-investigation tagged 17 PIs with tentative severity. **12 severity-adjustment events through s48** (see §9).

**Principles**:
- s38 tags are STARTING POINTS, NOT commitments.
- Mid-session bracket shifts are EVENTS; within-bracket refinements NOT events.
- Audit-method appendix in finding doc §11 captures all events through that session.
- Class-consistency precedent is primary anchor for adjudication.
- Magnitude factors (zero-UUID forensic recoverability, bounded LIMIT N, partial banner mitigation, aggregated-count display, UI binary-state) modulate impact but do NOT shift bracket per class-consistency precedent.
- Counter distinction (PLAN.md §4.1): severity-adjustment events ≠ methodology entries.
- **Ambiguous-pre-tag adjudication is NOT an event** (s48 clarification): bracket-pair pre-tags like {MEDIUM, HIGH} with Phase 5 selection are normal adjudication; only single-bracket-committed pre-tags adjudicated to a different bracket count as events.

## 19. Grand cumulative tally post-s48

| Cohort | Total | C | H | M | L |
|---|---|---|---|---|---|
| PI active+partial (6) | 6 | 2 | 3 | 1 | 0 |
| Batch 01 (s40) | 36 | 3 | 4 | 10 | 19 |
| Batch 02 (s41) | 36 | 5 | 10 | 8 | 13 |
| Batch 03 (s42) | 5 | 0 | 4 | 1 | 0 |
| Batch 04 (s43) | 5 | 0 | 3 | 2 | 0 |
| Batch 05 (s44) | 11 | 2 | 5 | 1 | 3 |
| Batch 06 (s45) | 8 | 2 | 3 | 0 | 3 |
| Batch 07 (s46) | 7 | 1 | 1 | 1 | 4 |
| Batch 08 (s47) | 10 | 2 | 3 | 0 | 5 |
| **Batch 09 (s48)** | **10** | **1** | **4** | **1** | **4** |
| **GRAND ACTIVE** | **134** | **18** | **40** | **25** | **51** |

Arithmetic: 6+36+36+5+5+11+8+7+10+10 = 134 ✓; C 2+3+5+0+0+2+2+1+2+1 = 18 ✓; H 3+4+10+4+3+5+3+1+3+4 = 40 ✓; M 1+10+8+1+2+1+0+1+0+1 = 25 ✓; L 0+19+13+0+0+3+3+4+5+4 = 51 ✓; 18+40+25+51 = 134 ✓.

PI Critical (active): PI-01 + PI-12 = 2.
PI High (active+partial): PI-09 + PI-10 + PI-16 = 3.
PI Medium (active): PI-17 = 1.

Net change s47 → s48: PI cohort −2 + batch-09 +10 = **+8 net**. By bracket: 0C / +3H / +1M / +4L.

## 20. What's next

**s49 batch 10-reports-analytics-payroll.**

**PI seeds owned**: PI-01 CRITICAL.

**Phase 0 ratification candidate**: drift #27 (cumulative tally arithmetic at PI closures; see §14).

**Cross-listed surfaces for batch-10** (pre-investigation needed):
- Reports surface (`/reports/*` routes + `useReport*` hooks)
- Analytics surface (dashboard widgets + drill-down)
- Payroll surface (UK PAYE-style teacher payment calculations)
- PI-01 CRITICAL anchor (retrieve s38 PI-01 text via STATUS.md or PLAN.md)

**Pre-investigation queries for s49** (apply all 29 methodology entries post-Phase-0 ratification):
- `information_schema.tables` regex-match on `report|analytics|payroll`
- `pg_constraint contype='c'` for ALL column-constraint claims
- `pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'` alongside `pg_constraint contype IN ('u','p')`
- `pg_enum` for all enum value claims
- RPC body via `pg_get_functiondef` BEFORE distribution queries
- Column existence via `information_schema.columns`
- Trigger event decoding via OR-able-bit CTE
- TS-bypass-cast multi-pattern sweep with literal patterns
- bun → npm setup auto-detect with `command -v` validation
- SECDEF body audit checklist (signature + search_path + EXECUTE grants + auth gating + body-level org check)
- Cross-batch reach mapping for every RPC
- Pattern catalog cross-reference: 33 placed + 3 candidates + 1 NEGATIVE-instance sub-class flag
- Filesystem-first edge fn enumeration
- CENSUS owning-batch verbatim cite
- DB-verified count canonical
- **Cumulative-tally projection with PI closure bracket subtraction per drift #27**
- PG POSIX regex word-boundary
- `grep -P` PCRE supports `\b`; `grep -E` ERE does NOT
- Sub-D explicit grep on edge fn helper signatures BEFORE Phase 2 EXIT
- Phase 10 commit pattern: s46 placeholder pattern (literal `<s49 Phase 10 commit SHA>` placeholders); `grep -c` verify count = 3

Frame s49 launching prompt with concrete file:line citations + DB evidence. No theory.

## 21. First action

Wait for Jamie's next message. It will be either:
- (a) a request to compose the s49 launching prompt for CC, or
- (b) a Phase 0 EXIT report from CC once s49 batch 10-reports-analytics-payroll has been dispatched.

Verify in CC's Phase 0 EXIT (when it arrives):
- HEAD at `<s48 Phase 10 commit SHA>`
- Banner intact: `AUDIT IN PROGRESS — DO NOT FIX YET` on STATUS.md
- READ-FIRST list ingested
- Tally on STATUS.md header reads **134 / 18 critical / 40 high / 25 medium / 51 low**
- s49 prep summary present
- **Drift #27 ratification** (Cat 1 reviewing-Claude origin; cumulative tally arithmetic at PI closures) — pushes Cat 1 from 26 to 27, total cumulative methodology from 28 to 29

Push back on:
- CC proposing to skip phases or merge phases
- Jamie proposing to fix or ship during audit
- Severity pre-tags carried through without rubric anchor citation
- Theory-based pre-investigation findings without file:line or DB evidence
- Migrations applied (`apply_migration` is forbidden during Phase B)
- Pattern catalog promotions / sub-class introductions surfacing at doc-write phase
- Phase 10 commit pattern attempts to embed final SHA in snapshot via amend
- Placeholder count not verified via `grep -c` before commit
- Cumulative tally projection that adds batch-findings-delta without subtracting closed-PI bracket counts (drift #27 mitigation)

Confirm readiness briefly, then wait for Jamie's next message.
