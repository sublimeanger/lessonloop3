# reviewing-Claude handover snapshot — s56 close (batch 17-loopassist)

Bootstrap document for the next reviewing-Claude session (s57). Composed at s56 Phase 10 pre-commit. Three literal placeholder tokens at §2 + §4 + §21 are intentional pointers per drift #39 invariant — read STATUS.md session log s56 row for the actual SHA.

---

## §1 Identity bootstrap + role definition

You are **reviewing-Claude** for the LessonLoop pre-launch audit. This is a multi-session systematic audit of a music-school management SaaS pre-launch, conducted in audit-only mode (no fix work until Phase B completes).

**Chain of communication**: Jamie ↔ reviewing-Claude ↔ Claude Code (CC).
- **Jamie** is the non-technical founder; he relays dispatches between reviewing-Claude (this Claude) and CC (a separate Claude instance in the terminal at the working tree).
- **CC** executes the audit work in `/tmp/lessonloop3-fresh`; produces phase EXIT reports.
- **reviewing-Claude** (you) reviews CC's EXIT reports, dispatches next-phase guidance, and HALTS for paste-back relay through Jamie.

**Communication conventions**:
- Short assessment + go-decision + paste-back code-fence per dispatch.
- 11-section Path Y prompt contract for every CC dispatch (§9 below).
- Direct honest feedback; no emojis; no timing predictions (audit is gate-driven, not deadline-driven).
- Push back if Jamie proposes shipping or fixing during Phase B — discipline contract violation.
- Verify codebase facts via repo + Supabase MCP; never guess.
- Do not interpret zero DB usage as evidence about product behaviour — zero active users; all DB rows are test data.

---

## §2 Project IDs + HEAD pin

**Supabase**:
- Dest (live): `xmrhmxizpslhtkibqyfy` (eu-west-1)
- Source (ref): `ximxgnkpcswbvfrkkmjq`

**Repo**: `github.com/sublimeanger/lessonloop3`

**CC working tree**: `/tmp/lessonloop3-fresh`

**HEAD pin at s56 close**: `<s56 Phase 10 commit SHA>` — actual SHA recorded in STATUS.md session log s56 row at L77. Pre-s56 HEAD was `2412c24d` (s55 close).

**Codebase upload for reviewing-Claude** (if needed for cross-verification): typically supplied as zip; previously `/mnt/user-data/uploads/lessonloop3-main__NN_.zip` → extract to `/home/claude/lessonloop3-main/`. Jamie can re-supply per session.

---

## §3 Cumulative state post-s56 close

- **Active findings**: 191 (20C / 52H / 28M / 91L) — net +7 at s56
- **Cumulative severity-adjustment events**: 16 (event #16 RATIFIED at s56: PI-12 → F-17-001 CRITICAL ↓ HIGH class-precedent reassessment per F-03-004 operational-correctness CAPS chain)
- **Cumulative methodology entries**: 42 (unchanged in count from s55; drift #30.A counter +1 documentation-only manifestation)
- **Pattern catalog**: 38 PLACED + 6 candidates + 8 sub-class introductions + 1 NEGATIVE-instance flag
  - **Pattern #44 NEW PLACED at s56**: 3-layer prompt-injection mitigation at looopassist-chat (sanitiseMessage L1314 + sanitiseForPrompt L37-47 + sanitisePref L1458-1467); single-anchor placement per Pattern #40/#41/#43 precedent
  - **Pattern #31 cohort 1 → 2 at s56**: bulk-process-continuation s48 anchor + looopassist-execute s56 NEW anchor; multi-layer defense-in-depth pre-sensitive-write OR pre-cross-batch-RPC-invocation
  - **Architectural-exception sub-class cohort 1 → 2 at s56**: ai_interaction_metrics + ai_messages; terminal-audit-via-table semantic IS the audit value
  - **CC-19 #4 ARCHITECTURAL N/A sub-shape cohort 1 → 2 at s56**: batch-14 + batch-17; server-side-gate-as-SSOT design philosophy
- **Drift #30.A cumulative operational manifestations**: 8 (s56 manifestation: unrestricted findings/*.md grep at Phase 1 §1.C pre-empted F-17-NNN over-allocation against closed-batch-05 helpers)
- **Drift #38 4-part attestation high-water mark**: 18/18 PASS at s56 Phase 5 §5.B (exceeds s55 16/16 baseline by +2 anchors)
- **Drift #36 STANDARD PROCEDURE**: 3rd operational application at s56 (helper SECDEF body re-verification: create_invoice_with_items + get_invoice_stats; ZERO drift)
- **Drift #41 §6 21-vector enumeration**: Phase 5.1 self-check clean at s56 (no manifestation; 21+1 vectors mapped to explicit audit decisions in findings/17 §11.N)

---

## §4 Session log highlight (s56 close)

**s56 commit SHA**: `<s56 Phase 10 commit SHA>` — see STATUS.md session log L77 for full SHA.

**s56 closure**:
- Batch 17-loopassist complete (LoopAssist edge fns + FE consumers + ai_* tables)
- 9 fresh F-17-NNN allocated (0C / 2H / 0M / 7L) contiguous F-17-001 through F-17-009
- PI cohort 5 → 3 (PI-12 RESOLVED via F-17-001 event #16; PI-16 RESOLVED via F-17-002 same-bracket)
- Capability #20 (multi-org isolation) POSITIVE; #21 (audit trail) MIXED-POSITIVE; #22 (role gating destructive) POSITIVE
- Event #16 RATIFIED: PI-12 CRITICAL ↓ HIGH via class-precedent reassessment per F-03-004 operational-correctness CAPS chain (kin to events #11 + #12 + #13)
- Workflow rule §3 rule 7 6th application clean at s56 Phase 0; 7th application expected CLEAN at s57 Phase 0 per Phase 10.7 proactive push

**Recent sessions** (selective):
- s50 — batch 11-portal: closed; Pattern #40 NEW PLACED single-anchor
- s51 — batch 12-messages-notifications: closed; Pattern #41 NEW PLACED single-anchor; Pattern #42 single-anchor candidate
- s52 — batch 13-practice-resources: closed; F-13-001 META cohort 13-fn AUTH-H5
- s53 — batch 14-bookings-leads-enrolment: closed; Pattern #43 NEW PLACED; CC-19 #4 ARCHITECTURAL N/A sub-shape introduced
- s54 — batch 15-calendar-sync-zoom-xero: closed; event #15 F-15-001 xero OAuth CRITICAL; Zoom sub-deferred carry to batch-18
- s55 — batch 16-subscription-tiers: closed; event #15 carry; F-16-007 Agency 5-surface manifestation; drift #38 16/16 PASS baseline
- s56 — batch 17-loopassist: closed THIS SESSION; event #16; Pattern #44 NEW; Pattern #31 cohort 2; 2 sub-class extensions

---

## §5 PI cohort entering s57

Active: **3 (0C / 2H / 1M / 0L)** — 14 RESOLVED tags (incl. PI-12 + PI-16 newly added at s56).

| PI-ID | Severity | Owner batch | Status entering s57 |
|---|---|---|---|
| PI-09 | HIGH | 19 cross-cutting | Active |
| PI-10 | HIGH | 18 settings-tabs (Zoom sub-surface carry from 15) | PARTIAL |
| PI-17 | MEDIUM | 19 cross-cutting | Active |

PI-12 + PI-16 transitioned Active → RESOLVED at s56 (see STATUS.md §5 PI register).

---

## §6 Phase B progress + remaining batches

**17 of 21 batches complete**.

Remaining batches:
1. **18 settings-tabs** (next; s57): Settings IA + Zoom sub-surface carry (PI-10 HIGH PARTIAL). V2_PLAN §5 cleanup PR3 reference: 24 tabs → 6 sections.
2. **19 cross-cutting class-pattern aggregation**: sweep of CC-19 carries + Pattern catalog candidates (#26 + #29 + #34 + #37 + #39 + #42) + F-13-001 META cohort ratification + POS-5 _activity-sibling-table 2-anchor pair + internal-trust observation watchlist.
3. **20 ux-flows**: end-to-end journey audit (J01-J13 per PLAN.md §5).
4. **21 marketing-surface**: public marketing pages + ZoomGuide sub-deferred from batch-21.

**Phase C-F gated on Phase B complete**:
- **Phase C — Fix Sprints**: critical-first remediation across active pool (currently 191 findings).
- **Phase D — Cohesion Sweep**: J01-J13 journeys walked end-to-end on staging.
- **Phase E — Lauren Shadow Term**: 12-week shadow programme using Lauren's school (Jamie's partner) as production-readiness forcing function (V2_PLAN §8).
- **Phase F — LoopAssist remediation completion**: subsumption case strengthened at s56 (capability #20/#21/#22 POSITIVE/MIXED-POSITIVE/POSITIVE verified); decision deferred until Phase B closes.

---

## §7 Pattern catalog state matrix (post-s56)

**PLACED slots**: 38 (Pattern #44 NEW at s56; sequential after Pattern #43 placed s53).

**Candidates**: 6 (slot numbers): #26 (batch-19 sweep) + #29 (batch-19 sweep) + #34 (post-launch) + #37 (batch-19 sweep) + #39 (batch-19 sweep) + #42 (batch-19 sweep target: F-12-008 single-anchor candidate registry-defined-but-uninvoked rate-limit key).

**Sub-class introductions**: 8 (cohort enrichments documentation-only per placement-slot invariance s47+ rule; counts unchanged at s56):
1. Pattern #27 sub-A continuation-portal-confirm (POSITIVE)
2. Pattern #27 sub-B PortalContinuation:71 NEGATIVE-instance flag (1 NEGATIVE-instance flag tally)
3. Pattern #41 RLS-policy substrate sub-class (cohort 2: F-05-001 + F-15-002 retrofit)
4. Pattern #41 4-anchor PLACED single-class cohort (F-12-003 + F-14-001 + F-15-001 + F-15-003)
5. ai_interaction_metrics architectural-exception sub-class (s49 origin; cohort 1 → 2 at s56 with ai_messages extension)
6. F-14 CC-19 #4 ARCHITECTURAL N/A sub-shape (s53 origin; cohort 1 → 2 at s56 with batch-17 extension)
7. POS-5 _activity-sibling-table 2-anchor pair (batch-12 + batch-14)
8. F-13-001 AUTH-H5 META cohort 13-fn (batch-19 ratification target)

**Pattern #31 cohort**: 2 anchors (s48 bulk-process-continuation + s56 looopassist-execute).

---

## §8 Drift mandates ledger

42 cumulative methodology entries through s56. Active OPERATIONAL CARRY entries (must propagate to every CC dispatch):

| # | Origin | Class-shape | Status |
|---|---|---|---|
| #23 | s47 | deno-missing-from-PATH; class-shape match s47 bun-not-installed (non-blocking for read-only audit) | LIVE flag |
| #25 | s46 | Placeholder pattern preservation in Phase 10 commit; s46 origin restored s48 | OPERATIONAL CARRY |
| #26 | s46 | grep -c placeholder count verification at Phase 10.3 (expected = 3) | OPERATIONAL CARRY |
| #27 | s48 | Drift #27 two-line check pre-commit arithmetic (PI cohort math + grand active math) | OPERATIONAL CARRY |
| #29 | s49 | EXECUTE grant enumeration mandate at Phase 1 §1.C | OPERATIONAL CARRY |
| #30 | s49 | CENSUS verbatim cite mandate for batch-attribution claims | OPERATIONAL CARRY |
| #30.A | s49 | Unrestricted findings/*.md grep at Phase 1 to pre-empt over-allocation against closed-batch anchors (8 cumulative operational manifestations through s56) | OPERATIONAL CARRY |
| #30.B | s50 | CENSUS verbatim line-cite at every batch-attribution claim point | OPERATIONAL CARRY |
| #31 | s50 | Finding-ID format consistency (F-NN-NNN; CC-19 #N; Pattern #N) | OPERATIONAL CARRY |
| #32 | s51 | Snapshot literal placeholders at §2 + §4 + §21 EXACTLY (3 placeholders per snapshot) | OPERATIONAL CARRY |
| #35 | s53 | 6-dim adjudication framework (D1-D6) for every fresh F-NN-NNN | OPERATIONAL CARRY |
| #35.A | s53 | Class-specific exemption rules (partial-coverage modulator + defense-in-depth-bounded + DiD-weaker observation) | OPERATIONAL CARRY |
| #35.B | s53 | Class-shape feature MATCH + class-shape header vs cohort-precedent distinction | OPERATIONAL CARRY |
| #36 | s54 | STANDARD PROCEDURE 3rd operational application at s56: live-DB `pg_get_functiondef` body re-verification on every cross-batch helper SECDEF invocation; verify ZERO drift vs anchor body | OPERATIONAL CARRY |
| #37 | s54 | V2_PLAN.md verbatim line-cite filesystem-verified at Phase 0 + Phase 6 doc-write; 4th operational application at s56 | OPERATIONAL CARRY |
| #38 | s54 | 4-part attestation per class-precedent citation (finding-ID + verbatim severity + verbatim class-shape one-liner + verbatim batch attribution); 18/18 PASS at s56 (exceeds s55 16/16 by +2) | OPERATIONAL CARRY |
| #39 | s54 | Snapshot literal placeholder retention scope: STATUS.md + HANDOVER.md substituted at Phase 10.6; snapshot retains literals | OPERATIONAL CARRY |
| #40 | s55 | Substrate migration filename cite verbatim filesystem-verified at Phase 6 | OPERATIONAL CARRY |
| #41 | s55 | §6 21-vector enumeration mandate at Phase 3 per-batch (every audit-decision vector mapped to F-NN-NNN allocation / citation-only carry / observation) + Phase 5.1 self-check; clean at s56 | OPERATIONAL CARRY |

Full methodology ledger in PLAN.md §4.1.

---

## §9 Workflow conventions

### 11-section Path Y prompt contract (every CC dispatch)

1. Session header (sNN + date + this/prev/next)
2. Setup steps (cd, git pull, install, baseline)
3. Token inventory (naming each token + location; never re-list values; never invent TOKENS.md)
4. Project IDs (dest + source + repo + working tree + HEAD)
5. READ-FIRST list
6. Pre-investigation findings (file/line/DB evidence only)
7. Scope in/out
8. Phases with EXIT + HALT each (Phase 0 includes HEAD-pin nuance: halt only if intervening commits touch audit/sweep/, HANDOVER.md substantively, relevant edge fns, or schema — pure cosmetic/widget/doc commits do not block)
9. Hard rules (never echo or log production secrets; length/prefix/suffix only for verification)
10. REQUIRED-UPDATES at session end (HANDOVER.md prepend + audit/sweep/STATUS.md update + findings batch annotation + any new doc)
11. EXIT report template (commits + findings closed with proof + findings deferred with reason + new findings for next batch + baseline test delta + confidence rating)

Missing any section is a discipline failure; push back.

### Phase ordering (s47+ refinement)

Phase 0 → 1 → 2 → 3 → 4 → 5 → 7 → 6 → 8 → 9 → 10.

Note: Phase 7 (Pattern catalog review) runs BEFORE Phase 6 (doc-write) per s47+ process refinement so that catalog deltas are resolved before doc commit.

### Split-message Phase 10 dispatch (s47+ pattern)

Message A: assessment + commit ops + EXIT shape; CC begins Phase 10.1-10.2 and HALTs before Phase 10.3.
Message B: verbatim handover snapshot content for `audit/sweep/handovers/reviewing-claude-sNN-close.md`.

CC writes snapshot at Phase 10.3, runs `grep -c "<sNN Phase 10 commit SHA>" snapshot.md = 3` verification, then commits.

### Closed-batch immutability (PLAN.md §6)

Zero modifications to closed-batch finding docs `findings/01..NN-1` after batch close. Cross-batch refs in new finding docs are READ-ONLY citations.

### s46+ placeholder pattern + drift #32/#39 invariant

Snapshot retains literal `<sNN Phase 10 commit SHA>` at §2 + §4 + §21 (exactly 3 occurrences). STATUS.md + HANDOVER.md placeholders substituted at Phase 10.6 amend. Snapshot literals are intentional pointers for next reviewing-Claude.

### s53+ proactive push pattern (workflow rule §3 rule 7)

Phase 10.7: `git push --force-with-lease origin main` after amend; sets up clean next-session Phase 0 (no pending push to verify). 6 cumulative clean applications through s56.

---

## §10 Source-of-truth file locations

| File | Purpose | Read priority at session start |
|---|---|---|
| `audit/sweep/STATUS.md` | Authoritative session state (header + tally + batch tracker + session log + PI register) | 1st read every session |
| `audit/sweep/handovers/reviewing-claude-sNN-close.md` | Bootstrap snapshot from prior reviewing-Claude (this file) | 2nd read |
| `audit/sweep/PLAN.md` | Path Y plan + ratifications + drift ledger + Pattern catalog state | 3rd read |
| `audit/sweep/CENSUS.md` | Feature catalogue (every feature categorised + batch attribution) | 4th read |
| `audit/sweep/findings/NN-batch-name.md` | Per-batch finding doc (immutable after close) | as needed |
| `HANDOVER.md` (top-level) | Session log; chronological prepend; CC + reviewing-Claude joint surface | always available |
| `audit/sweep/sprints/sprint-NN-name.md` | Fix sprint definitions (Phase C work; not yet active) | n/a in Phase B |
| `audit/feature-catalogues/NAME.md` | Per-domain capability matrix (e.g. loopassist.md row #1-#24) | as needed per batch |

LESSONLOOP_V2_PLAN.md (real launch plan, 1085 lines, 2026-05-09) is LOCAL COPY ONLY — NOT YET COMMITTED to repo per s39+ status. Reviewing-Claude reads from Jamie's local file if needed.

---

## §11 Working tree status

- **CC working tree**: `/tmp/lessonloop3-fresh`
- **HEAD at s56 close**: `<see STATUS.md L77>` (post Phase 10.6 amend + 10.7 push)
- **Baseline tests at s56**: 30 files (28 pass / 2 fail); 476 tests (471 pass / 5 fail)
- **Pre-existing test failures**: 5 in `src/test/crm/DeleteValidation.test.ts` (LL-CRM-P1-02; batch-14 closed; not gating audit)
- **Drift #23 deno-missing-from-PATH**: non-blocking flag (read-only audit doesn't need deno; class-shape match s47 bun-not-installed precedent)

---

## §12 CC drift catches (cumulative lessons learned)

Drift mandates emerge from CC error patterns caught at review. Pattern: a class of error gets named, mitigation procedure codified, applied retrospectively.

Major drift mandate clusters:
- **#1-#22**: early-session catches (s40-s47); foundational corrections
- **#23-#28**: s47-s48; baseline + commit hygiene + placeholder discipline
- **#29-#32**: s49-s51; CENSUS attribution + finding-ID format + snapshot invariants
- **#33-#34**: s52; intermediate refinements
- **#35-#36**: s53-s54; 6-dim adjudication framework + STANDARD PROCEDURE for cross-batch SECDEF body re-verification
- **#37-#41**: s54-s55; V2_PLAN cite + 4-part attestation + snapshot scope + substrate cite + vector enumeration

s56 added drift #30.A 8th cumulative operational manifestation (documentation-only counter increment). No new methodology entries surfaced at s56.

Pattern: drift counter increments without method change are NORMAL. New methodology entries require Phase 5 ratification.

---

## §13 Severity-adjustment methodology + cumulative events

**16 cumulative events through s56**. Driver types:
- **Composition discovery** (events #1, #2, #3, #5, #15): cross-batch chain reveals composition pathway elevating severity
- **Class-precedent reassessment** (events #11, #12, #13, **#16 at s56**): existing class-precedent applied to overturn pre-tag bracket
- **Closure-bracket-shift** (events #4, #6, #7, #8, #9, #10): finding fully closes with terminal bracket different from pre-tag
- **Safeguarding CAPS** (event #14): safeguarding/security/destructive/financial classes anchor at CRITICAL ceiling

**6-criterion event ratification framework**:
1. Pre-tag bracket verified
2. Final bracket verified per 6-dim adjudication
3. Bracket-shift verified (CRITICAL ↔ HIGH ↔ MEDIUM ↔ LOW)
4. Driver type identified
5. Composition probe negative (for class-precedent reassessment events)
6. Class-precedent chain (operational-correctness CAPS-at-HIGH or equivalent) verified

**Event #16 at s56**:
- PI-12 → F-17-001 CRITICAL ↓ HIGH
- Driver: class-precedent reassessment per F-03-004 operational-correctness CAPS chain (kin to events #11 + #12 + #13)
- Composition probe negative across F-02-005 + F-02-002 + F-08-001 + F-02-008 chains (zero composition path fires)
- Class-precedent chain: F-03-004 + F-05-003 + F-05-004 + F-05-005 + F-06-005 + F-09-007 + F-10-002 cumulative

---

## §14 Drift #38 4-part attestation OPERATIONAL CARRY

Every class-precedent citation in audit work must include 4-part attestation:
1. Finding-ID (or Pattern #N or CC-19 #N)
2. Verbatim severity (from anchor doc)
3. Verbatim class-shape one-liner (from anchor doc)
4. Verbatim batch attribution (NN-batch-name; closed)

Verification at Phase 5 §5.B per audit batch. s55 baseline 16/16 PASS; s56 high-water 18/18 PASS (+2 anchors: F-04-003 refined anchor + sub-class extensions).

Common pitfalls:
- Stating "F-04-003 cascade-completeness-asymmetry" without verbatim severity = INCOMPLETE
- Paraphrasing class-shape one-liner = INCOMPLETE
- Missing batch attribution = INCOMPLETE
- All four together = PASS

---

## §15 Drift #41 §6 21-vector enumeration OPERATIONAL CARRY

Per-batch Phase 3 dispatch must enumerate every audit-decision vector and map each to:
- Fresh F-NN-NNN allocation (with severity + class-shape + anchor)
- Citation-only carry (closed-batch immutability preserved)
- POSITIVE observation (no F-NN-NNN; Phase 6 §11 doc note)
- Sub-class extension (cohort enrichment; placement-slot invariance)
- NEGATIVE counter-example (Pattern catalog reinforcement)
- Capability closure (matrix verdict)

Phase 5.1 self-check before Phase 5 EXIT verifies all enumerated vectors received explicit audit decisions.

s56 result: 21+1 vectors all mapped (findings/17 §11.N 22-row table). Mitigation operating as designed; no manifestation surfaced.

Common vector classes:
- RLS policy WITH_CHECK NULL
- Schema column CHECK absence
- Edge fn `wrapEdgeFn` Sentry instrumentation absence
- Pattern #41 cross-tenant action via unvalidated identity
- Pattern #42 registry-defined-but-uninvoked rate-limit key
- Capability matrix verdict (per audit/feature-catalogues/NAME.md row)
- PI cohort closure
- Cross-batch helper SECDEF body re-verification (drift #36)
- Closed-batch citation extension (drift #30.A)

---

## §16 Path Y phases + gate-driven launch

Path Y is the audit-first pre-launch program. Gate-driven, not deadline-driven.

| Phase | Name | Status entering s57 |
|---|---|---|
| A | Census + Plan | COMPLETE (s39) |
| B | Systematic Audit (21 batches) | IN PROGRESS (17 of 21 complete) |
| C | Fix Sprints (critical-first) | gated on Phase B complete |
| D | Cohesion Sweep (J01-J13 journeys) | gated on Phase C complete |
| E | Lauren Shadow Term (12 weeks production) | gated on Phase D complete |
| F | LoopAssist remediation completion | subsumption case strengthened; decision deferred until Phase B closes |

**Banner**: `**AUDIT IN PROGRESS — DO NOT FIX YET**` (STATUS.md L12). Drops at Phase B close.

Discipline contract:
- No fix work permitted during Phase B
- Push back if Jamie proposes shipping or fixing during audit
- Zero exception for "small fixes"

---

## §17 V2_PLAN.md status + scope

**File**: `LESSONLOOP_V2_PLAN.md` (real launch plan; 1085 lines; dated 2026-05-09). **NOT YET COMMITTED to repo** per s39+ status; Jamie has local copy.

**IN-scope v1 features** (per V2_PLAN §3):
- Core loop (lessons + scheduling + attendance)
- Make-ups + continuation + term adjustments
- Practice + resources
- All reports
- Stripe Connect (payments + auto-pay)
- Scoped LoopAssist (read-only enabled; destructive deferred) — verbatim L301: `✅ LoopAssist scoped at launch (read-only enabled, destructive deferred)`
- Multi-org switching
- Internal messages
- Demo seeds
- Xero conditional

**HIDDEN scope** (deferred to v1.1+):
- Leads + enrolment waitlist (currently FE-rendered; not v1 launch path)
- Recurring templates
- Booking page
- Zoom
- Parent self-reschedule
- Parent LoopAssist
- Agency tier (currently FE-rendered as £79/mo; 6-surface manifestation tracked at F-16-007)

**Visible tiers at launch**: Teacher + Studio.

---

## §18 Lauren Shadow Programme status

**Agreed; not yet to build** (Phase B must finish first).

**Concept**: Jamie's partner Lauren is a music teacher running a ~250-pupil school. Her real-world workflow shapes LessonLoop's product direction. The "Lauren Shadow Term" (Phase E) is the production-readiness forcing function for launch.

**Mechanism** (designed; not built):
- 3 shadow orgs: Teacher / Studio / Agency
- Lauren primary on Agency tier
- Recipients: `jamie@searchflare.co.uk` + `laurentwilleypiano@gmail.com`
- `organisations.shadow_mode` flag + `_shared/shadow-email.ts` intercept + Sentry shadow tag
- Stripe test keys
- Reset function for shadow orgs

**Existing seed coverage**: `seed-demo-*` edge fns cover ~22/85 tables (~24%); shadow org rewrite needs to cover full v1 surface (~85 tables) + reset function.

---

## §19 Pre-emptive flags for s57 batch-18

**Next session task**: Begin Phase B / batch 18-settings-tabs (audit-only).

**Read order at s57 Phase 0**:
1. `audit/sweep/STATUS.md` (1st read)
2. `audit/sweep/handovers/reviewing-claude-s56-close.md` (this file; 2nd read)
3. `audit/sweep/PLAN.md` §5 batch 18 description + drift ledger
4. `audit/sweep/CENSUS.md` rows tagged 18
5. `audit/sweep/findings/17-loopassist.md` highlights (1110 lines; key sections §1 summary + §3.1-§3.9 fresh findings + §11.A-§11.N audit-method appendix)

**Batch 18 scope** (per PLAN.md §5 + CENSUS rows tagged 18):
- Settings IA surface (~24 tabs; V2_PLAN §5 cleanup PR3 reference target 6 sections)
- Zoom sub-surface carry from batch-15 close (s54)
- PI-10 HIGH PARTIAL owned by batch-18 (Zoom sub-surface)

**Key flags entering s57**:
- Workflow rule §3 rule 7 7th application expected CLEAN per s56 Phase 10.7 proactive push
- HEAD pin at s56 close: see STATUS.md session log L77
- Drift mandates carry: #23 + #29 + #30 + #30.A (8 cumulative) + #30.B + #31 + #32 + #35 + #35.A + #35.B + #36 standard procedure + #37 + #38 + #39 + #40 + #41
- F-16-007 Agency 6th manifestation surface added at s56 (closed-batch citation only; F-16-007 doc unchanged)
- 5 consumer-attribution CENSUS migration candidates DEFERRED to post-Phase-B sweep
- SOC 2 "aligned" qualifier note from findings/17 §11.L (marketing-chat L110; defensible at marketing; documentation-only)

---

## §20 Closing notes + carries entering s57

**Active CC-19 carries**: 16 cumulative cohorts (full enumeration in PLAN.md §4.1; s56 cohort enrichments: #10 +1 ~13; #11 +1 → 39; F-01-017 +2 → ≥37). Detailed delta table in findings/17 §11 audit-method appendix.

**Editorial carries** (post-Phase-B sweep):
- 5 consumer-attribution migration candidates (s51 Phase 7 PLAN.md L117 codification)
- E1-E7 editorial carries from s53/s54/s55 closes
- SOC 2 "aligned" qualifier observation (s56)

**Batch-19 ratification targets** (cross-cutting sweep):
- F-13-001 META cohort 13-fn AUTH-H5 ratification
- Pattern #42 single-anchor candidate (F-12-008)
- Pattern candidates #26 + #29 + #34 + #37 + #39 + #42 sweep targets
- POS-5 _activity-sibling-table 2-anchor pair adjudication
- Internal-trust observation watchlist (s49+ accumulated)

**Phase B completion outlook**: 4 batches remaining. No timing predictions; gate-driven.

**Phase F decision** (LoopAssist remediation completion): subsumption case strengthened at s56 close per capability #20/#21/#22 POSITIVE/MIXED-POSITIVE/POSITIVE verification. Decision deferred until Phase B closes; likely subsumed into Phase C critical-first fix sprints.

---

## §21 HEAD pin recap + next-session pointer

**HEAD at s56 close**: `<s56 Phase 10 commit SHA>` — actual SHA recorded in STATUS.md session log s56 row L77. Origin/main matches HEAD post Phase 10.7 proactive push (no pending push to verify at s57 Phase 0).

**Pre-s56 HEAD pin** (for diff reference): `2412c24d` (s55 close commit).

**Next-session pointer**: s57 batch 18-settings-tabs (audit-only). reviewing-Claude composes 11-section prompt contract for CC; CC executes Phase 0-10 of standard audit cycle. PI-10 HIGH PARTIAL Zoom sub-surface closure target at batch-18.

**Workflow rule §3 rule 7 7th application** expected CLEAN at s57 Phase 0 per s56 Phase 10.7 proactive push pattern.

**Cumulative audit state high-water marks** (preserve these as anchors for forward sessions):
- Active findings: 191 (s56)
- Cumulative events: 16 (s56)
- Cumulative methodology entries: 42 (s55 = s56; no new entries at s56)
- Pattern catalog PLACED: 38 (s56; Pattern #44 NEW)
- Drift #30.A cumulative manifestations: 8 (s56)
- Drift #38 attestation high-water: 18/18 PASS (s56)
- Phase B batches complete: 17 of 21 (s56)

End of snapshot.
