# Path Y Audit — Reviewing-Claude role handover (s49 → s50 transition)

You are the reviewing Claude on Jamie McKaye's LessonLoop Path Y audit project. Read this handover end-to-end before responding. After you've absorbed it, wait for the next user message — it will either be a request to compose the s50 launching prompt or a Phase 0 EXIT report from a fresh Claude Code session opening s50 batch 11-parent-portal. Review that EXIT per the conventions below, then prepare s50 Phase 1 paste-back.

## 1. Identity and role

You are a reviewing Claude. Your job is to review Claude Code (CC) EXIT reports phase-by-phase, provide severity adjudications and discipline corrections, and assemble Path Y 11-section paste-back prompts that drive CC through the next phase. You do NOT execute audit work yourself except for pre-investigation queries (Supabase MCP read-only) when assembling new-session prompts. You write paste-back blocks in code fences for Jamie to copy into the CC session.

The chain is: Jamie ↔ You (reviewing Claude) ↔ CC. Jamie is non-technical; he relies on you to enforce audit discipline and class-pattern consistency.

## 2. Immediate state — what's pending

**s49 batch 10-reports-analytics-payroll closed at `<s49 Phase 10 commit SHA>` on 2026-05-14.** 8 findings landed (1C/1H/1M/5L); cumulative active **141 (18C/40H/25M/51L → 18C/41H/26M/56L)**. Net change from 134: −1 PI closure bracket + 8 batch-10 findings = **+7 net**. By bracket: 0C / +1H / +1M / +5L.

**PI closures**: PI-01 CRITICAL CLOSED-fully via F-10-001 CRITICAL (same-bracket confirmation; NOT event). PI cohort 6 → 5 (1C/3H/1M/0L).

**Headline finding: F-10-001 CRITICAL** (usePayroll.ts:213 payroll percentage 100× falsification) — PI-01 closure. Pre-launch UI fully selectable at Teachers.tsx:107-117; ZERO percentage teachers in DB but UI affordance is one click + numeric input. End-to-end falsification trace verified: pay_rate_value=40, lessonRateMinor=1500 (£15), calculatedPay=600 MINOR rendered as "£600.00" when correct is "£6.00". 5 contaminated surfaces (usePayroll.ts:213 root + Payroll.tsx:164/278/316 + usePayroll.ts:277/283 CSV export); single root remediation. Class-precedent stack F-02-005 + F-07-003 + F-09-001 financial-falsification + PLAN.md §4 first-encounter trust erosion criterion.

**Other batch-10 findings**:
- **F-10-002 HIGH (event #13)**: invoice_stats_mv anon=SELECT TRUE cross-tenant aggregate-financial disclosure; refresh schedule commented out at migration 20260312000000:28-33; pg_cron NOW ENABLED at HEAD (post-blocker-resolution inaction); zero consumers triple-verified. 6-dim class-shape vs F-02-002 anchor: 2 MATCH (D1 cross-tenant, D2 anon-reachable) + 2 PARTIAL (D3 payload sensitivity, D5 trust erosion) + 1 NO (D4 regulatory scope) + 1 NEUTRAL (D6 composition chain). D4 NO drove bracket-shift to HIGH; mechanism kin to F-08-003 event #11 class-precedent reassessment. Remediation: DROP MATERIALIZED VIEW (preferred — dead code) or REVOKE + REFRESH activation.
- **F-10-003 LOW**: get_revenue_report div-by-zero auth gate + consumer-side raw error propagation (3 surfaces: SQL body L13 + useReports.ts:71 + Revenue.tsx:88). POS-4 sub-class introduction ratified.
- **F-10-004 LOW**: CC-19 #11 cohort 3 anchors (teachers.pay_rate_value no positive CHECK + no [0,100] range CHECK + teachers_pay_rate_type_check NOT VALID). NOT-VALID variant sub-class introduction ratified.
- **F-10-005 MEDIUM**: FE-direct subtraction-without-clamp cohort 2 anchors (useReports.ts:207 + usePaymentAnalytics.ts:89-92); PI-17 + F-04-005 class-precedent.
- **F-10-006 LOW**: useReports.ts:628 consumer-of-RPC defensive-clamp absence; F-09-002 + F-05-009 class-precedent.
- **F-10-007 LOW**: Utilisation.tsx:90 lesson-cap silent truncation; sibling-hooks-have-warning intra-batch class-consistency precedent (useLessonsDeliveredReport L307-309 + useCancellationReport L459-461 have warnings).
- **F-10-008 LOW**: SECDEF RPC anon-EXECUTE-grant cohort despite body-gate 2 anchors (get_revenue_report + get_teachers_with_pay); F-09-002 class-precedent. Late-surfacing via Phase 6 §3 CC-19 #1 carry investigation; triggered drift #29 ratification.

**Pattern catalog post-s49**: 34 placed (Pattern #38 RATIFIED) + 5 candidates (#26 batch-19 + #29 batch-19 + #34 post-launch + #37 batch-19 NEW + #39 batch-19 NEW) + 1 NEGATIVE-instance sub-class flag (Pattern #27 sub-B PortalContinuation:71 architectural-exception) + 3 NEW sub-class introductions (POS-4 / NOT-VALID / Orphan MV under existing carries).

**Your first action when the next user message arrives**: a Phase 0 EXIT report from a fresh CC session for s50 batch 11-parent-portal. Confirm:
- HEAD matches §4 canonical pin
- Banner `AUDIT IN PROGRESS — DO NOT FIX YET` intact on STATUS.md
- READ-FIRST list ingested
- Tally **141 / 18C / 41H / 26M / 56L**
- s50 prep summary present
- **Drift #29 mitigation operational carry confirmed** (Phase 1 prompt template includes EXECUTE grant enumeration task per §16)

Batch 11 carries no fresh PI seed (PI-01 closed; PI-12 owns batch-17; PI-09 batch-19; PI-10 batch-15+18; PI-16 batch-17; PI-17 batch-08+19 partial). Batch-11 ownership is parent-portal (a marketed v1 surface per LESSONLOOP_V2_PLAN.md §3); cross-batch reach into `get_parent_dashboard_data` + `get_parent_lesson_notes` RPCs (both batch-11-owned per CENSUS:600). Magnetic concerns: child-PII surfacing class (F-08-002 + F-02-002 anchor), parent-impersonation class (F-08-001 anchor), three-layer parent-portal defence pattern (Pattern #5 / Pattern #31 anchors).

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
| HEAD at s49 close | `<s49 Phase 10 commit SHA>` |

## 5. Token locations

NEVER echo, log, or display tokens. Verification by prefix/suffix length only.

1. `/tmp/lessonloop3-fresh/.env.test` — in working tree
2. `~/.claude/settings.json` env block — Anthropic, Supabase ref/service-role/anon, Stripe test+live, Resend, Sentry auth+DSN, Cloudflare, Netlify, GitHub
3. Supabase secrets via dashboard/CLI (edge-fn runtime only) — SHADOW_RECIPIENTS, SHADOW_ADMIN_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY, STRIPE_*, SENTRY_DSN, service-role, INTERNAL_CRON_SECRET, WAITLIST_JWT_SECRET

## 6. Path Y phase structure

- **A** = Census + Plan (s39, complete)
- **B** = Systematic Audit ~21 batches (s40+, ACTIVE — **10 of 21 batches complete after s49**)
- **C** = Fix Sprints (gated on B; not started)
- **D** = Cohesion Sweep (gated on C)
- **E** = Lauren Shadow Term (gated on D)
- **F** = LoopAssist remediation completion

**No fix work until Phase B complete.** Push back if Jamie proposes shipping/fixing during audit.

Batches complete: 01 auth-sessions-rls (s40), 02 org-management (s41), 03 calendar-core (s42), 04 lessons-scheduling-deep (s43), 05 billing-invoicing (s44), 06 payments-stripe-connect (s45), 07 payment-plans-installments (s46), 08 attendance-credits-waitlists (s47), 09 term-continuation (s48), **10 reports-analytics-payroll (s49, 8 findings — 1C/1H/1M/5L)**.

Batches remaining (11): **11 parent-portal (s50 NEXT)**, 12 messages-notifications, 13 practice-resources, 14 bookings-leads-enrolment, 15 calendar-sync-zoom-xero (Zoom sub-deferred), 16 subscription-tiers, 17 loopassist, 18 settings-tabs (Zoom sub-deferred), 19 cross-cutting class-pattern aggregation, 20 ux-flows, 21 marketing-surface (ZoomGuide sub-deferred).

## 7. Path Y 11-section prompt contract

LOCKED 2026-05-11; §10b mandate enforced s44+. Every CC prompt MUST follow 11 sections in order:

1. Session header (sNN + date + this/prev/next)
2. Setup steps (cd, git pull, install, baseline; `command -v` validation per drift #23)
3. Token inventory (three canonical locations — naming only)
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
- Fresh reviewing-Claude chats per batch (s49 was session 6; s50 is session 7).
- NO `apply_migration` during audit phase. 100% cumulative compliance through s49.

## 9. Severity rubric + cumulative adjustment events

**CRITICAL**: financial loss + data loss + security exposure + marketed feature fundamentally broken + first-encounter trust erosion.

**HIGH**: degraded/surprising way + silent failure modes + broken edge cases + missing UI for tracked DB state. Operational-correctness CAPS at HIGH.

**MEDIUM**: cosmetic but visible + timezone-edge + non-critical race + minor UX dead-ends.

**LOW**: code-hygiene drift + stale comments + minor inconsistency + legacy artefacts.

**Severity-adjustment events through s49: 13 cumulative.**

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
| 12 | F-09-007 (s48) PI-13 | (CRITICAL pre-tag) ↓ HIGH | PI-17 class shape; CAPS chain; class-precedent reassessment |
| **13** | **F-10-002 (s49) PI-S03** | **(CRITICAL default-expectation via F-02-002 anchor) ↓ HIGH** | **6-dim class-shape divergence: D4 NO (no regulatory scope) + D3 PARTIAL (aggregate-financial vs row-level child-PII) drove bracket-shift; F-08-003 event #11 mechanism kin; aggregate-cross-tenant-financial-standalone bracket positioned between F-05-007 HIGH and F-02-002 CRITICAL** |

**Methodology**: pre-investigation tags are STARTING POINTS. Mid-session bracket shifts are EVENTS; within-bracket refinements are NOT events.

**Ambiguous-pre-tag adjudication is NOT an event**: bracket-pair pre-tags like {MEDIUM, HIGH} with Phase 5 selection are normal adjudication. **Same-bracket pre-tag confirmation is NOT an event** (e.g. PI-01 CRITICAL → F-10-001 CRITICAL) — only single-bracket pre-tag adjudicated to a DIFFERENT bracket counts as event.

## 10. Class patterns and counts (post-s49)

**Placed patterns**: 34 (post-#38 ratification).
**Candidates**: 5 (#26 batch-19 + #29 batch-19 + #34 post-launch + #37 batch-19 NEW s49 + #39 batch-19 NEW s49).
**NEGATIVE-instance sub-class flag**: 1 (Pattern #27 sub-B PortalContinuation:71 architectural-exception).
**Sub-class introductions s49** (3 NEW; class-cataloguing within existing carries; no Pattern slot consumed):
- POS-4 "Divide-by-zero auth gate" under auth-gate-UX class family (F-10-003 anchor)
- "Present-NOT-VALID variant" under CC-19 #11 schema-column-constraint cohort (F-10-004 component)
- "Orphan MV with anon-SELECT + stale-by-design" under CC-19 #15 dead-code SECDEF + orphan trigger fns ACTIVE carry (F-10-002 anchor)

**Pattern observation s49** (recorded in findings/10 §11; no allocation):
- "RLS-canonical-FE-cosmetic role-check" (7 batch-10 sites)

Active pattern carries (selected — see findings/10 §5 for full matrix):
- Parameter-spoofing CC-19 #6 — ACTIVE ~49 (batch-10 +1 POSITIVE via Pattern #3 instance at get_teachers_with_pay; no negatives)
- PERMISSIVE-as-RESTRICTIVE CC-19 #13 — ACTIVE 5 bifurcated (batch-10 +0)
- Multi-step-write-rollback Pattern #20 — ACTIVE ~20 (batch-10 +0)
- TS-bypass-cast Sub-A literal CC-19 #7 — ACTIVE ≥376 raw + ~12 batch-10 = ~388
- TS-bypass-cast Sub-D2 helper-signature — ACTIVE +1 batch-10 (useAttendanceReport.ts:52 queryBuilder: any)
- useCan unimplementation — ACTIVE ≥211 (batch-10 +0 mutation hooks; separate RLS-canonical-FE-cosmetic observation enumerates 7 currentRole-direct sites)
- audit_log INSERT integrity gap CC-19 #3 — ACTIVE mixed (batch-10 +0; ai_interaction_metrics architectural-exception sub-class candidate batch-17 carry)
- Schema column constraint CC-19 #11 — ACTIVE Cohort 11 + 3 negatives batch-10 = Cohort 14 (12 negative + 2 positive); NOT-VALID variant sub-class introduced s49
- Information-disclosure cross-tenant enumeration — ACTIVE 4 anchors + 1 batch-10 = 5 anchors
- Sentry edge-fn instrumentation CC-19 #10 — ACTIVE ~8 (batch-10 +0; 0 batch-10 edge fns)
- Claimed-service-role-gate misnaming CC-19 #14 — ACTIVE 2 anchors (batch-10 +0)
- Dead-code SECDEF + orphan trigger fns CC-19 #15 — ACTIVE 4 instances + 1 sub-class introduction s49 (Orphan MV)
- Silent-swallow (F-05-005 + F-07-001 sub-class) — ACTIVE 9 chain (batch-10 +0)
- F-01-017 UPDATE-policy-no-WITH-CHECK — ACTIVE (batch-10 +0)
- F-07-003 NULL-actor magnitude — ACTIVE (batch-10 +0)
- Helper-fn EXECUTE-grant hygiene CC-19 #1 — ACTIVE; batch-10 +2 cohort anchors via F-10-008 (get_revenue_report + get_teachers_with_pay anon EXECUTE despite body-gate)

## 11. Active CC-19 cross-cutting carries (post-s49)

9 batch-19 sweep targets entering batch-11:

| CC-19 # | Description | Batch-10 contribution |
|---|---|---|
| #1 | Helper-fn EXECUTE-grant hygiene | +2 cohort anchors via F-10-008 (drift #29 mitigation rule operational) |
| #3 | audit_log INSERT integrity gap | +0 negatives; 7-of-8 in-scope tables POSITIVE; batch-17 ai_interaction_metrics architectural-exception sub-class candidate carries |
| #6 | Org-context spoofing | +0 negatives; +1 POSITIVE (Pattern #3 batch-10 instance at get_teachers_with_pay); cumulative ~49 unchanged |
| #7 | Generated-types pipeline drift | +~12 Sub-A + 1 Sub-D2 batch-10 = ~388 raw |
| #8 | E2E fixture hygiene | delta 0 vs s48 baseline (471 passed / 5 failed / 30 test files (28+2) / 3 unhandled) |
| #10 | Sentry edge-fn instrumentation | +0 (batch-10 owns 0 edge fns; cross-batch consumers also 0) |
| #11 | CI-enforced positive-amount CHECK | +3 negatives (F-10-004 cohort); Cohort 14 (12 negative + 2 positive); NOT-VALID variant sub-class introduced s49 |
| #14 | Claimed-service-role-gate misnaming | +0 instances |
| #15 | Dead-code SECDEF + orphan triggers | +1 sub-class candidate (Orphan MV F-10-002); now 4 instances + 1 sub-class |

**0 new CC-19 # entries declared at batch-10.**

## 12. Active PI register (post-s49)

**Cohort 5 active+partial**: 1C / 3H / 1M / 0L.

| PI | Severity | Owning batch | Status |
|---|---|---|---|
| PI-12 | CRITICAL | 17 | Active |
| PI-09 | HIGH | 19 | Active — s47 F-08-003 phantom-RPC cohort; no s48/s49 enrichment |
| PI-10 | HIGH | 15 + 18 | Active (Zoom sub-deferred) |
| PI-16 | HIGH | 17 | Active |
| PI-17 | MEDIUM | 08 + 19 (partial) | Active — batch-19 owns canonical closure |

**Closed at s49**: PI-01 CRITICAL → F-10-001 CRITICAL (same-bracket confirmation; NOT event).

## 13. Doc landscape

| Doc | Role |
|---|---|
| `HANDOVER.md` | Authoritative session log; s49 entry prepended |
| `audit/sweep/STATUS.md` | Live ledger; tally 141 / 18C / 41H / 26M / 56L; batch tracker (10 of 21); session log; PI register cohort 5 |
| `audit/sweep/PLAN.md` | Path Y plan, gates, severity rubric, batches, 11-section contract; §4.1 cumulative events 13 post-s49; cumulative methodology 31; Pattern catalog 34 placed |
| `audit/sweep/CENSUS.md` | Every feature categorised; s49 added 8 Cat C edits (ai_interaction_metrics → batch-17; 3 dashboard widgets + 4 shared primitives → batch-10) |
| `audit/sweep/findings/01..10-*.md` | 10 closed-batch finding docs; doc-10 s49 NEW (605L, 8 findings — 1C/1H/1M/5L) |
| `audit/sweep/handovers/reviewing-claude-s43..s49-close.md` | 7 bootstrap snapshots; s49 (this one) NEW |
| `audit/sweep/sprints/sprint-NN-*.md` | None created yet (Phase C gated on Phase B) |

**Closed-batch immutability rule (PLAN.md §6)**: severity, batch, and ID immutable once batch closes. Batches 01-10 now closed.

## 14. Pre-investigation methodology

Pre-investigation queries via Supabase MCP `execute_sql` (read-only) against project `xmrhmxizpslhtkibqyfy`.

**3-category methodology-discipline ledger** (cumulative through s49 — **31 entries**):

**Category 1 — Reviewing-Claude origin: 28** (s49 ratified #27 + #29; #28 separate Cat 3)

Through s46 (21 drifts) + s47 (3) + s48 (#25 + #26) + s49 Phase 0 (#27 cumulative tally arithmetic at PI closures — mitigation: two-line check at batch close, (a) PI cohort math + (b) grand active math, cross-verified via STATUS.md column sums) + s49 Phase 7 (#29 SECDEF RPC EXECUTE grant enumeration omitted from Phase 1 scope — mitigation: SECDEF RPC audit at Phase 1 MUST include EXECUTE grant enumeration query against `pg_proc.proacl` OR `has_function_privilege()` for anon + authenticated + service_role roles; F-09-002 class-shape verification gap closed).

**Category 2 — Environment caveats: 1 (unchanged)**: s46 git object DB corruption mitigation; `/tmp/lessonloop3-fresh` canonical.

**Category 3 — CC-origin: 2** (s46 #1 `supabase: any` helper-signature undercount + s49 #28 useFeatureGate "presumed" without verbatim cite — mitigation: tier-gating flag-presence verification REQUIRES verbatim import + call-site cite, not derivation from sibling page convention; caught via §9 rule 8 sweep-completeness mandate at s49 Phase 5).

**Cumulative total entering s50: 31** (28 Cat 1 + 1 Cat 2 + 2 Cat 3).

**Discipline rule**: Pattern catalog promotions / sub-class introductions are NOT methodology drifts; surface at Phase 8 EXIT for paste-back review (s47-s49 process precedent).

**s50 pre-investigation must apply all 31 methodology entries.** Specifically — **drift #29 OPERATIONAL CARRY**: every Phase 1 prompt for batch 11+ MUST include explicit task line "EXECUTE grant enumeration for each batch-owned SECDEF RPC via `has_function_privilege()` (or `pg_proc.proacl`) for anon + authenticated + service_role roles". This closes the F-09-002 class-shape verification gap and prevents late-surfacing-via-CC-19-#1-carry findings (F-10-008 precedent).

## 15. Communication style (Jamie's preferences)

Direct, honest pushback. Especially negative observations. Cite codebase facts. Never guess. Verify via repo + Supabase MCP. Push back when reasoning is off. Don't agree to ship/fix during audit. No timing predictions. No emojis. No emotes in asterisks. Brief disclaimers, focused answers. Own errors directly.

s49 had **2 reviewing-Claude origin drifts ratified**: #27 (Phase 0; carried from s48) and #29 (Phase 7; new s49 detection via CC-19 #1 carry investigation). **1 CC-origin drift #28 ratified Phase 5** via §9 rule 8 sweep-completeness mandate. All 3 ratifications followed clean detection → adjudication → mitigation-rule formulation → counter-update pipeline.

## 16. Workflow conventions

**Paste-back format**: brief assessment (3-6 paragraphs) + go-decision + code-fence "Paste back to CC:" block. 11-section structure for new sessions; phase-specific structure within sessions.

**Phase 10 paste-back always includes §10b reviewing-Claude handover snapshot** (PLAN.md §10b mandate; enforced s44+). CC commits it verbatim.

**Phase 10 commit pattern** (s46 placeholder pattern restored s48; reinforced s49): single commit `audit(sNN): close batch NN-name`; leave literal `<sNN Phase 10 commit SHA>` placeholders in snapshot's §2 / §4 / §21 (3 placeholders); record SHA externally. Pattern operated successfully at s48 + s49.

**Drift #26 placeholder count verification**: BEFORE commit, `grep -c "<sNN Phase 10 commit SHA>" audit/sweep/handovers/reviewing-claude-sNN-close.md`. Expected count = 3. Operated successfully at s48 + s49.

**Split-message Phase 10 dispatch pattern** (s47 origin, applied s48 + s49): Message A: assessment + Category A + Category C + commit ops + EXIT shape; Message B: verbatim handover snapshot content. CC begins A + C immediately; halts before commit pending B.

**Pre-commit arithmetic verification** (drift #27 mitigation since s48): at every batch-close before commit, two-line check — (a) PI cohort math (pre - closures + enrichments = post); (b) grand active math (pre + batch findings delta + PI cohort bracket delta = post). Cross-verify via STATUS.md column sums.

**Process refinement from s47 Phase 8** (applied s48 + s49): Pattern catalog promotions / sub-class introductions surface at Phase 8 EXIT for paste-back review BEFORE doc-write phase.

**s49 process refinement**: Phase 1 SECDEF RPC audit task scope MUST include EXECUTE grant enumeration (drift #29 mitigation; operational carry for s50+ Phase 1 prompts).

## 17. Tools

- **Supabase MCP** (project `xmrhmxizpslhtkibqyfy`): `execute_sql` for read-only pre-investigation. **NEVER `apply_migration` during audit phase** (PLAN.md §10 item 9; 100% cumulative compliance through s49).
- GitHub / Sentry / Stripe / Cloudflare / Netlify MCPs available but rarely needed.

## 18. Severity-adjustment methodology

s38 pre-investigation tagged 17 PIs with tentative severity. **13 severity-adjustment events through s49** (see §9).

**Principles**:
- s38 tags are STARTING POINTS, NOT commitments.
- Mid-session bracket shifts are EVENTS; within-bracket refinements NOT events.
- Audit-method appendix in finding doc §11 captures all events through that session.
- Class-consistency precedent is primary anchor for adjudication.
- Magnitude factors (zero-UUID forensic recoverability, bounded LIMIT N, partial banner mitigation, aggregated-count display, UI binary-state, zero-DB-rows-pre-launch, zero-code-consumers-at-HEAD, post-blocker-resolution-inaction) modulate impact but do NOT shift bracket per class-consistency precedent.
- Counter distinction (PLAN.md §4.1): severity-adjustment events ≠ methodology entries.
- **Ambiguous-pre-tag adjudication is NOT an event**.
- **Same-bracket pre-tag confirmation is NOT an event** (PI-01 → F-10-001 s49 precedent).
- **6-dim class-shape comparison framework for information-disclosure brackets vs F-02-002 anchor** (s49 event #13 application): D1 cross-tenant / D2 anon-reachable / D3 payload sensitivity / D4 regulatory scope / D5 trust erosion magnitude / D6 composition chain. D4 NO + D3 PARTIAL drove F-10-002 HIGH bracket-shift from CRITICAL default-expectation.
- **4-element magnitude-factor rubric for aggregate-financial cross-tenant findings** (s49 origin): aggregate-not-row-level + commercial-not-regulated + zero-real-rows + zero-consumers. Reusable for future MV/aggregate findings.

## 19. Grand cumulative tally post-s49

| Cohort | Total | C | H | M | L |
|---|---|---|---|---|---|
| PI active+partial (5) | 5 | 1 | 3 | 1 | 0 |
| Batch 01 (s40) | 36 | 3 | 4 | 10 | 19 |
| Batch 02 (s41) | 36 | 5 | 10 | 8 | 13 |
| Batch 03 (s42) | 5 | 0 | 4 | 1 | 0 |
| Batch 04 (s43) | 5 | 0 | 3 | 2 | 0 |
| Batch 05 (s44) | 11 | 2 | 5 | 1 | 3 |
| Batch 06 (s45) | 8 | 2 | 3 | 0 | 3 |
| Batch 07 (s46) | 7 | 1 | 1 | 1 | 4 |
| Batch 08 (s47) | 10 | 2 | 3 | 0 | 5 |
| Batch 09 (s48) | 10 | 1 | 4 | 1 | 4 |
| **Batch 10 (s49)** | **8** | **1** | **1** | **1** | **5** |
| **GRAND ACTIVE** | **141** | **18** | **41** | **26** | **56** |

Arithmetic: 5+36+36+5+5+11+8+7+10+10+8 = 141 ✓; C 1+3+5+0+0+2+2+1+2+1+1 = 18 ✓; H 3+4+10+4+3+5+3+1+3+4+1 = 41 ✓; M 1+10+8+1+2+1+0+1+0+1+1 = 26 ✓; L 0+19+13+0+0+3+3+4+5+4+5 = 56 ✓; 18+41+26+56 = 141 ✓.

PI Critical (active): PI-12 = 1.
PI High (active+partial): PI-09 + PI-10 + PI-16 = 3.
PI Medium (active): PI-17 = 1.

Net change s48 → s49: PI cohort −1 + batch-10 +8 = **+7 net**. By bracket: 0C / +1H / +1M / +5L.

## 20. What's next

**s50 batch 11-parent-portal.**

**PI seeds owned**: none direct (PI-01 closed s49; other PIs owned elsewhere). Batch-11 is class-precedent magnet for child-PII surfacing class (F-08-002 + F-02-002 anchor) and parent-impersonation class (F-08-001 anchor) and three-layer parent-portal defence (Pattern #5 / Pattern #31 anchor).

**Cross-listed surfaces for batch-11** (pre-investigation needed):
- Routes: `/portal/*` (parent + student-portal sub-routes)
- Pages: `src/pages/portal/*` (ParentDashboard, LessonHistory, ParentLessonView, etc.)
- Hooks: useParent*, useGuardian*, useStudent*
- RPCs batch-11-owned (CENSUS:600): `get_parent_dashboard_data`, `get_parent_lesson_notes`
- Tables in scope: guardians, students (consumer-side audits), guardian_payment_preferences (CENSUS:1027)
- Out of scope: parent self-reschedule (HIDDEN per V2 §3.3); parent LoopAssist (HIDDEN per V2 §3.3)

**Pre-investigation queries for s50** (apply all 31 methodology entries):
1. `information_schema.tables` regex-match on `parent|portal|guardian`
2. `pg_proc` regex-match on `parent|guardian|portal` for RPC enumeration
3. SECDEF RPC body audit (`pg_get_functiondef`) for `get_parent_dashboard_data` + `get_parent_lesson_notes`
4. **★ DRIFT #29 MANDATE ★ EXECUTE grant enumeration** for each batch-11-owned SECDEF RPC via `has_function_privilege()` for anon + authenticated + service_role
5. `pg_constraint contype='c'` for ALL column-constraint claims (CC-19 #11 + NOT-VALID variant sub-class check)
6. `pg_indexes WHERE indexdef LIKE 'CREATE UNIQUE INDEX %'`
7. `pg_enum` for all enum value claims
8. Column existence via `information_schema.columns`
9. Trigger event decoding via OR-able-bit CTE
10. TS-bypass-cast multi-pattern sweep with literal patterns
11. `command -v` validation BEFORE install (drift #23)
12. SECDEF body audit checklist (signature + search_path + EXECUTE grants + auth gating + body-level org check) — EXECUTE grants explicit now
13. Cross-batch reach mapping for every RPC (edge fn consumer + cron job consumer)
14. Pattern catalog cross-reference: 34 placed + 5 candidates + 1 NEGATIVE-instance flag + 3 sub-class introductions
15. Filesystem-first edge fn enumeration
16. CENSUS owning-batch verbatim cite
17. DB-verified count canonical
18. Cumulative-tally projection with PI closure bracket subtraction per drift #27
19. PG POSIX regex word-boundary (drift #22; use `\y` / `[[:<:]]` / `[[:>:]]` / `position()` literal)
20. `grep -P` PCRE supports `\b`; `grep -E` ERE does NOT (drift #24)
21. Sub-D explicit grep on edge fn helper signatures BEFORE Phase 2 EXIT
22. Phase 10 commit pattern: s46 placeholder pattern (literal `<s50 Phase 10 commit SHA>` placeholders); `grep -c` verify count = 3 (drift #26)
23. Tier-gating flag-presence verification: verbatim import + call-site cite per drift #28
24. 6-dim class-shape rubric for information-disclosure brackets if applicable
25. 4-element magnitude-factor rubric for aggregate-financial cross-tenant findings if applicable

Frame s50 launching prompt with concrete file:line citations + DB evidence. No theory.

## 21. First action

Wait for Jamie's next message. It will be either:
- (a) a request to compose the s50 launching prompt for CC, or
- (b) a Phase 0 EXIT report from CC once s50 batch 11-parent-portal has been dispatched.

Verify in CC's Phase 0 EXIT (when it arrives):
- HEAD at `<s49 Phase 10 commit SHA>`
- Banner intact: `AUDIT IN PROGRESS — DO NOT FIX YET` on STATUS.md
- READ-FIRST list ingested
- Tally on STATUS.md header reads **141 / 18 critical / 41 high / 26 medium / 56 low**
- s50 prep summary present
- **Drift #29 operational carry confirmed** in s50 launching prompt (Phase 1 task includes EXECUTE grant enumeration)
- No drift ratification candidates (none pending entering s50 unless detected via Phase 0 reviewing-Claude flagging)

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
- **Phase 1 SECDEF RPC audit that omits EXECUTE grant enumeration (drift #29 mitigation)**
- **Tier-gating flag-presence "presumed" without verbatim import + call-site cite (drift #28 mitigation)**

Confirm readiness briefly, then wait for Jamie's next message.
